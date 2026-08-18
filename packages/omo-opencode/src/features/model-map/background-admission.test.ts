import { describe, expect, test } from "bun:test"

import {
  captureFallbackAttemptRoute,
  createBackgroundRouteResolver,
  createModelMapLaunchIntent,
  linearizeBackgroundRoute,
} from "./background-admission"
import type { ModelMapController } from "./types"

function controller(resolve: ModelMapController["resolve"]): ModelMapController {
  return {
    clear: async () => {},
    deleteSession: () => {},
    list: () => [],
    resolve,
    show: async () => undefined,
    use: async () => {},
  }
}

describe("background modelmap admission", () => {
  test("#given mutable routing inputs #when launch intent is created #then queued facts are immutable snapshots", () => {
    const baseModel = { providerID: "base", modelID: "primary" }
    const fallbackChain = [{ model: "fallback", providers: ["provider-a"] }]

    const intent = createModelMapLaunchIntent({
      baseModel,
      fallbackChain,
      key: "quick",
      kind: "category",
      sessionID: "ses_parent",
    })
    baseModel.modelID = "mutated"
    fallbackChain[0]?.providers.push("provider-b")

    expect(intent.baseModel).toEqual({ providerID: "base", modelID: "primary" })
    expect(intent.fallbackChain).toEqual([{ model: "fallback", providers: ["provider-a"] }])
    expect(Object.isFrozen(intent)).toBe(true)
    expect(Object.isFrozen(intent.fallbackChain?.[0]?.providers)).toBe(true)
  })

  test("#given a controller route #when background admission resolves #then route model and fallback state are frozen copies", async () => {
    const model = { providerID: "mapped", modelID: "primary" }
    const fallbackChain = [{ model: "fallback", providers: ["provider-a"] }]
    const resolve = createBackgroundRouteResolver(controller(async () => ({
      concurrencyKey: "mapped/primary",
      fallbackChain,
      mappedKey: "quick",
      model,
      presetName: "quality",
      revision: 7,
      scope: "session",
      source: "model-map",
    })))

    const captured = await resolve(createModelMapLaunchIntent({
      baseModel: { providerID: "base", modelID: "primary" },
      key: "quick",
      kind: "category",
      sessionID: "ses_parent",
    }))
    model.modelID = "mutated"
    fallbackChain[0]?.providers.push("provider-b")

    expect(captured).toMatchObject({ model: { providerID: "mapped", modelID: "primary" }, revision: 7 })
    expect(captured?.fallbackChain).toEqual([{ model: "fallback", providers: ["provider-a"] }])
    expect(Object.isFrozen(captured)).toBe(true)
  })

  test("#given a captured route #when a fallback attempt is derived #then provenance and revision stay pinned while the model changes", () => {
    const captured = captureFallbackAttemptRoute(linearizeBackgroundRoute({
      concurrencyKey: "mapped/primary",
      fallbackChain: [{ model: "fallback", providers: ["provider-a"] }],
      mappedKey: "quick",
      model: { providerID: "mapped", modelID: "primary" },
      presetName: "quality",
      revision: 4,
      scope: "session",
      source: "model-map",
    }), { providerID: "provider-a", modelID: "fallback" })

    expect(captured).toMatchObject({
      concurrencyKey: "provider-a/fallback",
      model: { providerID: "provider-a", modelID: "fallback" },
      presetName: "quality",
      revision: 4,
      scope: "session",
      source: "model-map",
      linearizationPoint: "post-initial-capacity",
    })
  })

  test("#given a captured route #when admission linearizes #then the immutable route records the admission point", () => {
    const linearized = linearizeBackgroundRoute({
      concurrencyKey: "provider-a/first",
      mappedKey: "quick",
      model: { providerID: "provider-a", modelID: "first" },
      revision: 3,
      scope: "session" as const,
      source: "model-map" as const,
    })

    expect(linearized.linearizationPoint).toBe("post-initial-capacity")
    expect(Object.isFrozen(linearized)).toBe(true)
  })
})
