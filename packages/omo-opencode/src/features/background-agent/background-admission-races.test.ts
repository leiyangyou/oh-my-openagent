import { afterEach, describe, expect, test } from "bun:test"

import {
  attemptRoutes,
  createAdmissionHarness,
  intent,
  launchInput,
  route,
  type AdmissionHarness,
  waitFor,
} from "./background-admission.test-support"

const harnesses: AdmissionHarness[] = []

afterEach(() => {
  for (const harness of harnesses.splice(0)) harness.manager.shutdown()
})

describe("background admission ownership races", () => {
  test("#given sustained route revisions #when the first queued key admits #then one resolved attempt route linearizes before another revision can starve its prompt", async () => {
    let resolutionCount = 0
    let signalSecondResolution: (() => void) | undefined
    let signalPrompt: (() => void) | undefined
    const secondResolution = new Promise<void>((resolve) => {
      signalSecondResolution = resolve
    })
    const prompted = new Promise<void>((resolve) => {
      signalPrompt = resolve
    })
    const harness = createAdmissionHarness(async () => {
      const revision = ++resolutionCount
      if (revision === 2) signalSecondResolution?.()
      return route({
        model: { providerID: `provider-${revision}`, modelID: `model-${revision}` },
        revision,
      })
    }, { defaultConcurrency: 1 }, () => signalPrompt?.())
    harnesses.push(harness)
    const task = await harness.launch(launchInput({
      id: "sustained-revisions",
      model: { providerID: "base", modelID: "model" },
      routeIntent: intent({ model: { providerID: "base", modelID: "model" } }),
    }))

    try {
      const outcome = await Promise.race([
        prompted.then(() => "prompted" as const),
        secondResolution.then(() => "resolved-again" as const),
      ])
      expect(outcome).toBe("prompted")
      expect(resolutionCount).toBe(1)
    } finally {
      await harness.manager.cancelTask(task.id, { abortSession: false, skipNotification: true })
    }
  })

  test("#given a late route with a different key #when transfer completes #then old capacity is released and new capacity is acquired once", async () => {
    const harness = createAdmissionHarness(async () => route({
      model: { providerID: "new-provider", modelID: "new-model" },
      revision: 1,
    }))
    harnesses.push(harness)
    const acquisitions: string[] = []
    const releases: string[] = []
    const acquire = harness.concurrency.acquire.bind(harness.concurrency)
    const release = harness.concurrency.release.bind(harness.concurrency)
    harness.concurrency.acquire = async (model, taskId, onAcquired) => acquire(model, taskId, (key) => {
      acquisitions.push(key)
      onAcquired?.(key)
    })
    harness.concurrency.release = (model) => {
      releases.push(model)
      release(model)
    }
    const task = await harness.launch(launchInput({
      id: "transfer",
      model: { providerID: "old-provider", modelID: "old-model" },
      routeIntent: intent({ model: { providerID: "old-provider", modelID: "old-model" } }),
    }))
    await waitFor(() => harness.prompts.length === 1, "the transferred task to start")

    expect(harness.concurrency.getCount("old-provider/old-model")).toBe(0)
    expect(harness.concurrency.getCount("new-provider/new-model")).toBe(1)
    await harness.manager.cancelTask(task.id, { abortSession: false, skipNotification: true })
    expect(harness.concurrency.getCount("new-provider/new-model")).toBe(0)
    expect(acquisitions).toEqual(["old-provider/old-model", "new-provider/new-model"])
    expect(releases).toEqual(["old-provider/old-model", "new-provider/new-model"])
  })

  test("#given route resolution fails after initial acquisition #when admission aborts #then initial capacity releases once without a prompt", async () => {
    let signalRelease: (() => void) | undefined
    const capacityReleased = new Promise<void>((resolve) => {
      signalRelease = resolve
    })
    const harness = createAdmissionHarness(async () => {
      throw new Error("route resolution failed")
    })
    harnesses.push(harness)
    const releases: string[] = []
    const release = harness.concurrency.release.bind(harness.concurrency)
    harness.concurrency.release = (model) => {
      releases.push(model)
      release(model)
      signalRelease?.()
    }
    const task = await harness.launch(launchInput({
      id: "resolution-error",
      model: { providerID: "base", modelID: "error" },
      routeIntent: intent({ model: { providerID: "base", modelID: "error" } }),
    }))

    await capacityReleased

    expect(harness.prompts).toHaveLength(0)
    expect(releases).toEqual(["base/error"])
    expect(harness.manager.getTask(task.id)?.status).toBe("error")
  })

  test("#given cancellation after transferred capacity is assigned #when admission has not resumed #then final ownership releases once without a duplicate start", async () => {
    const harness = createAdmissionHarness(async () => route({
      model: { providerID: "target", modelID: "occupied" },
      revision: 1,
    }))
    harnesses.push(harness)
    let pauseTransferredAcquisition = false
    let signalTargetAcquired: (() => void) | undefined
    let signalContinueAcquisition: (() => void) | undefined
    const targetAcquired = new Promise<void>((resolve) => {
      signalTargetAcquired = resolve
    })
    const continueAcquisition = new Promise<void>((resolve) => {
      signalContinueAcquisition = resolve
    })
    const acquisitions: string[] = []
    const releases: string[] = []
    const acquire = harness.concurrency.acquire.bind(harness.concurrency)
    const release = harness.concurrency.release.bind(harness.concurrency)
    harness.concurrency.acquire = async (model, taskId, onAcquired) => {
      await acquire(model, taskId, (key) => {
        acquisitions.push(key)
        onAcquired?.(key)
        if (pauseTransferredAcquisition && model === "target/occupied") signalTargetAcquired?.()
      })
      if (pauseTransferredAcquisition && model === "target/occupied") await continueAcquisition
    }
    harness.concurrency.release = (model) => {
      releases.push(model)
      release(model)
    }
    const blocker = await harness.launch(launchInput({ id: "target-blocker", model: { providerID: "target", modelID: "occupied" } }))
    await waitFor(() => harness.prompts.length === 1, "the target blocker to start")
    pauseTransferredAcquisition = true
    const queued = await harness.launch(launchInput({
      id: "cancel-transfer",
      model: { providerID: "old", modelID: "free" },
      routeIntent: intent({ model: { providerID: "old", modelID: "free" } }),
    }))
    await waitFor(() => harness.concurrency.getQueueLength("target/occupied") === 1, "the transferred waiter")

    await harness.manager.cancelTask(blocker.id, { abortSession: false, skipNotification: true })
    await targetAcquired
    expect(await harness.manager.cancelTask(queued.id, { abortSession: false, skipNotification: true })).toBe(true)
    signalContinueAcquisition?.()

    expect(harness.prompts).toHaveLength(1)
    expect(harness.concurrency.getCount("old/free")).toBe(0)
    expect(harness.concurrency.getCount("target/occupied")).toBe(0)
    expect(harness.concurrency.getQueueLength("target/occupied")).toBe(0)
    expect(acquisitions).toEqual(["target/occupied", "old/free", "target/occupied"])
    expect(releases).toEqual(["old/free", "target/occupied", "target/occupied"])
  })

  test("#given an admitted fallback chain #when the map changes before retry #then retry uses the original captured chain", async () => {
    const originalFallback = [{ model: "original-fallback", providers: ["fallback-provider"] }]
    let current = route({
      model: { providerID: "mapped", modelID: "primary" },
      revision: 1,
      fallbackChain: originalFallback,
    })
    const harness = createAdmissionHarness(async () => current)
    harnesses.push(harness)
    const task = await harness.launch(launchInput({
      id: "fallback",
      model: { providerID: "base", modelID: "primary" },
      fallbackChain: originalFallback,
      routeIntent: intent({ model: { providerID: "base", modelID: "primary" }, fallbackChain: originalFallback }),
    }))
    await waitFor(() => harness.prompts.length === 1, "the primary attempt to start")
    current = route({
      model: { providerID: "mapped", modelID: "new-primary" },
      revision: 2,
      fallbackChain: [{ model: "new-fallback", providers: ["new-provider"] }],
    })
    const stored = harness.manager.getTask(task.id)
    if (!stored) throw new Error("Expected admitted task")
    const retryMethod: unknown = Reflect.get(harness.manager, "tryFallbackRetry")
    if (typeof retryMethod !== "function") throw new Error("Expected fallback retry method")

    await Reflect.apply(retryMethod, harness.manager, [stored, { name: "OverloadedError", message: "overloaded" }, "test"])
    await waitFor(() => harness.prompts.length === 2, "the fallback attempt to start")

    expect(harness.prompts.map((request) => request.model?.modelID)).toEqual(["primary", "original-fallback"])
    expect(attemptRoutes(stored)).toEqual([
      expect.objectContaining({ revision: 1 }),
      expect.objectContaining({ revision: 1 }),
    ])
  })

  test("#given provider-level concurrency and unchanged normalized keys #when mapped tasks wait #then admission preserves FIFO", async () => {
    let revision = 0
    const harness = createAdmissionHarness(async () => route({
      model: { providerID: "provider-a", modelID: `mapped-${++revision}` },
      revision,
    }), { providerConcurrency: { "provider-a": 1 } })
    harnesses.push(harness)
    const blocker = await harness.launch(launchInput({ id: "fifo-blocker", model: { providerID: "provider-a", modelID: "blocker" } }))
    await waitFor(() => harness.prompts.length === 1, "the FIFO blocker to start")
    const first = await harness.launch(launchInput({
      id: "fifo-first",
      model: { providerID: "provider-a", modelID: "base-first" },
      routeIntent: intent({ model: { providerID: "provider-a", modelID: "base-first" } }),
    }))
    await harness.launch(launchInput({
      id: "fifo-second",
      model: { providerID: "provider-a", modelID: "base-second" },
      routeIntent: intent({ model: { providerID: "provider-a", modelID: "base-second" } }),
    }))

    await harness.manager.cancelTask(blocker.id, { abortSession: false, skipNotification: true })
    await waitFor(() => harness.prompts.length === 2, "the first mapped FIFO task")
    await harness.manager.cancelTask(first.id, { abortSession: false, skipNotification: true })
    await waitFor(() => harness.prompts.length === 3, "the second mapped FIFO task")

    expect(harness.prompts.slice(1).map((request) => request.model?.modelID)).toEqual(["mapped-1", "mapped-2"])
  })
})
