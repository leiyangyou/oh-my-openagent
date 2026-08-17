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

describe("late-bound background admission", () => {
  test("#given a task waiting on its base key #when the map revision changes #then its first attempt adopts the new route", async () => {
    let current = route({ model: { providerID: "mapped", modelID: "revision-one" }, revision: 1 })
    const harness = createAdmissionHarness(async () => current)
    harnesses.push(harness)
    const blocker = await harness.launch(launchInput({ id: "blocker", model: { providerID: "base", modelID: "queued" } }))
    await waitFor(() => harness.prompts.length === 1, "the blocker to start")
    const queued = await harness.launch(launchInput({
      id: "queued",
      model: { providerID: "base", modelID: "queued" },
      routeIntent: intent({ model: { providerID: "base", modelID: "queued" } }),
    }))
    current = route({ model: { providerID: "mapped", modelID: "revision-two" }, revision: 2 })

    await harness.manager.cancelTask(blocker.id, { abortSession: false, skipNotification: true })
    await waitFor(() => harness.prompts.length === 2, "the queued task to start")

    const admitted = harness.manager.getTask(queued.id)
    expect(harness.prompts[1]?.model).toEqual({ providerID: "mapped", modelID: "revision-two" })
    expect(attemptRoutes(admitted ?? queued)[0]).toMatchObject({ revision: 2, concurrencyKey: "mapped/revision-two" })
  })

  test("#given an active mapped attempt #when the map changes #then it stays pinned and a later task uses the newer revision", async () => {
    let current = route({ model: { providerID: "mapped", modelID: "revision-one" }, revision: 1 })
    const harness = createAdmissionHarness(async () => current)
    harnesses.push(harness)
    const first = await harness.launch(launchInput({
      id: "first",
      model: { providerID: "base", modelID: "first" },
      routeIntent: intent({ model: { providerID: "base", modelID: "first" } }),
    }))
    await waitFor(() => harness.prompts.length === 1, "the first task to start")
    current = route({ model: { providerID: "mapped", modelID: "revision-two" }, revision: 2 })
    const second = await harness.launch(launchInput({
      id: "second",
      model: { providerID: "base", modelID: "second" },
      routeIntent: intent({ model: { providerID: "base", modelID: "second" } }),
    }))
    await waitFor(() => harness.prompts.length === 2, "the independent task to start")

    expect(attemptRoutes(harness.manager.getTask(first.id) ?? first)[0]).toMatchObject({ revision: 1 })
    expect(attemptRoutes(harness.manager.getTask(second.id) ?? second)[0]).toMatchObject({ revision: 2 })
    expect(harness.prompts.map((request) => request.model?.modelID)).toEqual(["revision-one", "revision-two"])
  })

  test("#given an explicit queued model #when a map route exists #then admission preserves the explicit route", async () => {
    const explicit = { providerID: "explicit", modelID: "pinned" }
    const harness = createAdmissionHarness(async (request) => route({
      model: request.explicitModel ?? { providerID: "mapped", modelID: "ignored" },
      revision: 0,
      scope: request.explicitModel === undefined ? "session" : "explicit",
      source: request.explicitModel === undefined ? "model-map" : "explicit",
    }))
    harnesses.push(harness)

    const task = await harness.launch(launchInput({
      id: "explicit",
      model: explicit,
      routeIntent: intent({ model: explicit, explicitModel: explicit }),
    }))
    await waitFor(() => harness.prompts.length === 1, "the explicit task to start")

    expect(harness.prompts[0]?.model).toEqual(explicit)
    expect(attemptRoutes(harness.manager.getTask(task.id) ?? task)[0]).toMatchObject({ source: "explicit", scope: "explicit" })
  })

  test("#given repeated map changes during transfer #when admission settles #then exactly one attempt starts on the latest observed revision", async () => {
    const revisions = [
      route({ model: { providerID: "mapped", modelID: "revision-one" }, revision: 1 }),
      route({ model: { providerID: "mapped", modelID: "revision-two" }, revision: 2 }),
    ]
    let index = 0
    const harness = createAdmissionHarness(async () => revisions[Math.min(index++, revisions.length - 1)])
    harnesses.push(harness)

    const task = await harness.launch(launchInput({
      id: "repeated",
      model: { providerID: "base", modelID: "initial" },
      routeIntent: intent({ model: { providerID: "base", modelID: "initial" } }),
    }))
    await waitFor(() => harness.prompts.length === 1, "the transferred task to start")

    const stored = harness.manager.getTask(task.id) ?? task
    expect(harness.prompts).toHaveLength(1)
    expect(harness.prompts[0]?.model?.modelID).toBe("revision-two")
    expect(stored.attempts).toHaveLength(1)
    expect(attemptRoutes(stored)[0]).toMatchObject({ revision: 2 })
  })
})
