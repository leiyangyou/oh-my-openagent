import { describe, expect, test } from "bun:test"

import { scheduleRetryAttempt, startAttempt } from "./attempt-lifecycle"
import { ConcurrencyManager } from "./concurrency"
import type { BackgroundTask } from "./types"

function createPendingTask(): BackgroundTask {
  return {
    agent: "sisyphus-junior",
    description: "characterize retry ownership",
    id: "bg_characterization",
    model: { providerID: "provider-a", modelID: "primary" },
    parentMessageId: "msg_parent",
    parentSessionId: "ses_parent",
    prompt: "characterize current behavior",
    status: "pending",
  }
}

describe("background admission characterization", () => {
  test("#given provider concurrency one #when normalized model waiters are released #then FIFO order is preserved", async () => {
    const manager = new ConcurrencyManager({ providerConcurrency: { anthropic: 1 } })
    await manager.acquire("anthropic/first", "running")
    const order: string[] = []
    const second = manager.acquire("anthropic/second", "second").then(() => order.push("second"))
    const third = manager.acquire("anthropic/third", "third").then(() => order.push("third"))
    await Promise.resolve()

    manager.release("anthropic/first")
    await second
    manager.release("anthropic/second")
    await third

    expect(order).toEqual(["second", "third"])
    expect(manager.getCount("anthropic")).toBe(1)
    manager.release("anthropic/third")
    expect(manager.getCount("anthropic")).toBe(0)
  })

  test("#given two queued waiters #when the first is cancelled #then the next receives the released slot", async () => {
    const manager = new ConcurrencyManager({ defaultConcurrency: 1 })
    await manager.acquire("model-a", "running")
    const cancelledErrors: string[] = []
    const cancelled = manager.acquire("model-a", "cancelled").catch((error: Error) => {
      cancelledErrors.push(error.message)
    })
    let nextStarted = false
    const next = manager.acquire("model-a", "next").then(() => {
      nextStarted = true
    })
    await Promise.resolve()

    expect(manager.cancelWaiter("model-a", "cancelled")).toBe(true)
    await cancelled
    manager.release("model-a")
    await next

    expect(cancelledErrors).toEqual(["Concurrency queue cancelled for task: cancelled"])
    expect(nextStarted).toBe(true)
    manager.release("model-a")
  })

  test("#given a running attempt #when a fallback is scheduled #then the failed attempt is append-only and the next model is explicit", () => {
    const task = createPendingTask()
    const first = startAttempt(task, task.model)
    first.status = "running"
    first.sessionId = "ses_primary"

    const retry = scheduleRetryAttempt(
      task,
      first.attemptId,
      { providerID: "provider-b", modelID: "fallback" },
      "primary overloaded",
    )

    expect(task.attempts?.[0]).toMatchObject({
      attemptId: first.attemptId,
      error: "primary overloaded",
      modelId: "primary",
      providerId: "provider-a",
      sessionId: "ses_primary",
      status: "error",
    })
    expect(retry).toMatchObject({ modelId: "fallback", providerId: "provider-b", status: "pending" })
    expect(task.model).toEqual({ providerID: "provider-b", modelID: "fallback" })
  })

  test("#given independent tasks #when each starts #then attempt model state is not shared", () => {
    const firstTask = createPendingTask()
    const secondTask = { ...createPendingTask(), id: "bg_independent" }

    const firstAttempt = startAttempt(firstTask, { providerID: "provider-a", modelID: "revision-one" })
    const secondAttempt = startAttempt(secondTask, { providerID: "provider-b", modelID: "revision-two" })

    expect(firstAttempt).toMatchObject({ providerId: "provider-a", modelId: "revision-one" })
    expect(secondAttempt).toMatchObject({ providerId: "provider-b", modelId: "revision-two" })
  })
})
