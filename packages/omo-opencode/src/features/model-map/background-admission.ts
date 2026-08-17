import type { FallbackEntry } from "../../shared/model-requirements"
import type { DelegatedModelConfig } from "../../shared/model-resolution-types"
import type {
  BackgroundRouteResolver,
  CapturedModelMapRoute,
  LinearizedBackgroundRoute,
  ModelMapController,
  ModelMapLaunchIntent,
  ModelMapRouteRequest,
  ResolvedModelMapRoute,
} from "./types"
import { BACKGROUND_ROUTE_LINEARIZATION_POINT } from "./types"

function cloneModel(model: DelegatedModelConfig): DelegatedModelConfig {
  return {
    ...model,
    ...(model.tools === undefined ? {} : { tools: { ...model.tools } }),
  }
}

function cloneFallbackEntry(entry: FallbackEntry): FallbackEntry {
  const providers = [...entry.providers]
  Object.freeze(providers)
  return Object.freeze({ ...entry, providers })
}

function cloneFallbackChain(
  fallbackChain: readonly FallbackEntry[] | undefined,
): readonly FallbackEntry[] | undefined {
  return fallbackChain === undefined
    ? undefined
    : Object.freeze(fallbackChain.map(cloneFallbackEntry))
}

export function createModelMapLaunchIntent(input: ModelMapRouteRequest): ModelMapLaunchIntent {
  return Object.freeze({
    ...input,
    ...(input.baseModel === undefined ? {} : { baseModel: Object.freeze(cloneModel(input.baseModel)) }),
    ...(input.explicitModel === undefined ? {} : { explicitModel: Object.freeze(cloneModel(input.explicitModel)) }),
    ...(input.fallbackChain === undefined ? {} : { fallbackChain: cloneFallbackChain(input.fallbackChain) }),
  })
}

export function captureModelMapRoute(route: ResolvedModelMapRoute): CapturedModelMapRoute {
  return Object.freeze({
    ...route,
    model: Object.freeze(cloneModel(route.model)),
    ...(route.fallbackChain === undefined ? {} : { fallbackChain: cloneFallbackChain(route.fallbackChain) }),
  })
}

export function linearizeBackgroundRoute(route: CapturedModelMapRoute): LinearizedBackgroundRoute {
  return Object.freeze({
    ...route,
    linearizationPoint: BACKGROUND_ROUTE_LINEARIZATION_POINT,
  })
}

export function createBackgroundRouteResolver(controller: ModelMapController): BackgroundRouteResolver {
  return async (intent) => {
    const route = await controller.resolve(intent)
    return route === undefined ? undefined : captureModelMapRoute(route)
  }
}

export function captureFallbackAttemptRoute(
  route: LinearizedBackgroundRoute,
  model: DelegatedModelConfig,
): LinearizedBackgroundRoute {
  return linearizeBackgroundRoute(captureModelMapRoute({
    ...route,
    concurrencyKey: `${model.providerID}/${model.modelID}`,
    model,
  }))
}
