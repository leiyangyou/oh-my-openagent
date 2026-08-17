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
  test("#given a late route with a different key #when transfer completes #then old capacity is released and new capacity is acquired once", async () => {
    const harness = createAdmissionHarness(async () => route({
      model: { providerID: "new-provider", modelID: "new-model" },
      revision: 1,
    }))
    harnesses.push(harness)
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
  })

  test("#given cancellation while a transferred task waits #when both reservations clear #then no capacity leaks or duplicate start occur", async () => {
    const harness = createAdmissionHarness(async () => route({
      model: { providerID: "target", modelID: "occupied" },
      revision: 1,
    }))
    harnesses.push(harness)
    const blocker = await harness.launch(launchInput({ id: "target-blocker", model: { providerID: "target", modelID: "occupied" } }))
    await waitFor(() => harness.prompts.length === 1, "the target blocker to start")
    const queued = await harness.launch(launchInput({
      id: "cancel-transfer",
      model: { providerID: "old", modelID: "free" },
      routeIntent: intent({ model: { providerID: "old", modelID: "free" } }),
    }))
    await waitFor(() => harness.concurrency.getQueueLength("target/occupied") === 1, "the transferred waiter")

    expect(await harness.manager.cancelTask(queued.id, { abortSession: false, skipNotification: true })).toBe(true)
    await harness.manager.cancelTask(blocker.id, { abortSession: false, skipNotification: true })

    expect(harness.prompts).toHaveLength(1)
    expect(harness.concurrency.getCount("old/free")).toBe(0)
    expect(harness.concurrency.getCount("target/occupied")).toBe(0)
    expect(harness.concurrency.getQueueLength("target/occupied")).toBe(0)
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
