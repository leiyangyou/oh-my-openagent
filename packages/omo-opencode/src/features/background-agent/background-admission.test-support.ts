import type { PluginInput } from "@opencode-ai/plugin"

import type { ModelMapRouteRequest, ResolvedModelMapRoute } from "../model-map"
import { ConcurrencyManager } from "./concurrency"
import { BackgroundManager } from "./manager"
import type { BackgroundTask, LaunchInput } from "./types"

export type TestRouteResolver = (intent: ModelMapRouteRequest) => Promise<ResolvedModelMapRoute | undefined>

export type PromptRequest = {
  readonly agent?: string
  readonly model?: { readonly providerID: string; readonly modelID: string }
  readonly variant?: string
}

export type AdmissionHarness = {
  readonly manager: BackgroundManager
  readonly prompts: PromptRequest[]
  readonly concurrency: ConcurrencyManager
  launch(input: LaunchInput & { readonly routeIntent?: ModelMapRouteRequest }): Promise<BackgroundTask>
}

function pluginInput(client: object): PluginInput {
  return Object.assign({ client, directory: "/tmp/modelmap-background-admission" })
}

export function route(input: {
  readonly model: { readonly providerID: string; readonly modelID: string }
  readonly revision: number
  readonly source?: ResolvedModelMapRoute["source"]
  readonly scope?: ResolvedModelMapRoute["scope"]
  readonly fallbackChain?: ResolvedModelMapRoute["fallbackChain"]
}): ResolvedModelMapRoute {
  return {
    concurrencyKey: `${input.model.providerID}/${input.model.modelID}`,
    ...(input.fallbackChain === undefined ? {} : { fallbackChain: input.fallbackChain }),
    mappedKey: "quick",
    model: input.model,
    presetName: "test-preset",
    revision: input.revision,
    scope: input.scope ?? "session",
    source: input.source ?? "model-map",
  }
}

export function createAdmissionHarness(
  resolveBackgroundRoute: TestRouteResolver,
  concurrencyConfig: { readonly defaultConcurrency?: number; readonly providerConcurrency?: Record<string, number> } = {
    defaultConcurrency: 1,
  },
): AdmissionHarness {
  const prompts: PromptRequest[] = []
  let sessionNumber = 0
  const client = {
    session: {
      abort: async () => ({ data: true }),
      create: async () => ({ data: { id: `ses_admission_${++sessionNumber}` } }),
      get: async () => ({ data: { directory: "/tmp/modelmap-background-admission" } }),
      promptAsync: async (input: { readonly body?: PromptRequest }) => {
        prompts.push(input.body ?? {})
        return { data: true }
      },
      status: async () => ({ data: {} }),
    },
  }
  const managerOptions = {
    pluginContext: pluginInput(client),
    config: concurrencyConfig,
    enableParentSessionNotifications: false,
    resolveBackgroundRoute,
  }
  const manager = new BackgroundManager(managerOptions)
  Reflect.set(manager, "reserveSubagentSpawn", async () => ({
    spawnContext: { rootSessionID: "ses_parent", parentDepth: 0, childDepth: 1 },
    descendantCount: 1,
    commit: () => 1,
    rollback: () => {},
  }))
  const concurrencyValue: unknown = Reflect.get(manager, "concurrencyManager")
  if (!(concurrencyValue instanceof ConcurrencyManager)) {
    throw new Error("BackgroundManager did not expose its concurrency manager")
  }

  return {
    manager,
    prompts,
    concurrency: concurrencyValue,
    launch: (input) => manager.launch(input),
  }
}

export function launchInput(input: {
  readonly id: string
  readonly model: { readonly providerID: string; readonly modelID: string }
  readonly routeIntent?: ModelMapRouteRequest
  readonly fallbackChain?: ModelMapRouteRequest["fallbackChain"]
}): LaunchInput & { readonly routeIntent?: ModelMapRouteRequest } {
  return {
    agent: "sisyphus-junior",
    description: input.id,
    ...(input.fallbackChain === undefined ? {} : { fallbackChain: [...input.fallbackChain] }),
    model: input.model,
    parentMessageId: `msg_${input.id}`,
    parentSessionId: "ses_parent",
    prompt: `prompt ${input.id}`,
    ...(input.routeIntent === undefined ? {} : { routeIntent: input.routeIntent }),
  }
}

export function intent(input: {
  readonly model: { readonly providerID: string; readonly modelID: string }
  readonly explicitModel?: { readonly providerID: string; readonly modelID: string }
  readonly fallbackChain?: ModelMapRouteRequest["fallbackChain"]
}): ModelMapRouteRequest {
  return {
    baseModel: input.model,
    ...(input.explicitModel === undefined ? {} : { explicitModel: input.explicitModel }),
    ...(input.fallbackChain === undefined ? {} : { fallbackChain: input.fallbackChain }),
    key: "quick",
    kind: "category",
    sessionID: "ses_parent",
  }
}

export async function waitFor(predicate: () => boolean, description: string): Promise<void> {
  const deadline = Date.now() + 1_000
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}`)
    }
    await Bun.sleep(5)
  }
}

export function attemptRoutes(task: BackgroundTask): ReadonlyArray<ResolvedModelMapRoute | undefined> {
  return (task.attempts ?? []).map((attempt) => attempt.route)
}
