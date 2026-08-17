import type { OmoModelRef } from "@oh-my-opencode/omo-config-core"

import { InvalidModelMapRouteError } from "./errors"
import type { ModelMapRouteRequest, ModelMapSelection, ResolvedModelMapRoute } from "./types"
import type { DelegatedModelConfig } from "../../shared/model-resolution-types"

function toDelegatedModel(route: OmoModelRef): DelegatedModelConfig {
  const reference = typeof route === "string" ? { model: route } : route
  const separator = reference.model.indexOf("/")
  if (separator < 1 || separator === reference.model.length - 1) {
    throw new InvalidModelMapRouteError(reference.model)
  }

  return {
    modelID: reference.model.slice(separator + 1),
    providerID: reference.model.slice(0, separator),
    ...(reference.reasoning === undefined ? {} : { reasoning: reference.reasoning }),
    ...(reference.temperature === undefined ? {} : { temperature: reference.temperature }),
    ...(reference.top_p === undefined ? {} : { top_p: reference.top_p }),
    ...(reference.max_tokens === undefined ? {} : { maxTokens: reference.max_tokens }),
  }
}

function concurrencyKey(model: DelegatedModelConfig): string {
  return `${model.providerID}/${model.modelID}`
}

function resolvedRoute(
  input: ModelMapRouteRequest,
  model: DelegatedModelConfig,
  metadata: Pick<ResolvedModelMapRoute, "revision" | "scope" | "source"> & { readonly presetName?: string },
): ResolvedModelMapRoute {
  return {
    concurrencyKey: concurrencyKey(model),
    ...(input.fallbackChain === undefined ? {} : { fallbackChain: input.fallbackChain }),
    mappedKey: input.key,
    model: { ...model },
    ...(metadata.presetName === undefined ? {} : { presetName: metadata.presetName }),
    revision: metadata.revision,
    scope: metadata.scope,
    source: metadata.source,
  }
}

export function resolveModelMapRoute(
  input: ModelMapRouteRequest,
  selection: ModelMapSelection | undefined,
): ResolvedModelMapRoute | undefined {
  if (input.explicitModel !== undefined) {
    return resolvedRoute(input, input.explicitModel, { revision: 0, scope: "explicit", source: "explicit" })
  }

  const mapped = selection?.preset[input.kind === "agent" ? "agents" : "categories"]?.[input.key]
  if (mapped !== undefined && selection !== undefined) {
    return resolvedRoute(input, toDelegatedModel(mapped), {
      presetName: selection.name,
      revision: selection.revision,
      scope: selection.scope,
      source: "model-map",
    })
  }

  if (input.baseModel === undefined) return undefined
  return resolvedRoute(input, input.baseModel, { revision: 0, scope: "base", source: "base" })
}
