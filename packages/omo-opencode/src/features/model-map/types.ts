import type { OmoModelPreset } from "@oh-my-opencode/omo-config-core"
import type { FallbackEntry } from "../../shared/model-requirements"
import type { DelegatedModelConfig } from "../../shared/model-resolution-types"

export const MODEL_MAP_SCOPES = ["global", "workspace", "session"] as const
export type ModelMapScope = (typeof MODEL_MAP_SCOPES)[number]

export type ModelMapSelection = {
  readonly name: string
  readonly preset: OmoModelPreset
  readonly revision: number
  readonly scope: ModelMapScope
}

export type ModelMapRouteRequest = {
  readonly baseModel?: DelegatedModelConfig
  readonly explicitModel?: DelegatedModelConfig
  readonly fallbackChain?: readonly FallbackEntry[]
  readonly key: string
  readonly kind: "agent" | "category"
  readonly sessionID: string
}

export type ResolvedModelMapRoute = {
  readonly concurrencyKey: string
  readonly fallbackChain?: readonly FallbackEntry[]
  readonly mappedKey: string
  readonly model: DelegatedModelConfig
  readonly presetName?: string
  readonly revision: number
  readonly scope: ModelMapScope | "base" | "explicit"
  readonly source: "base" | "explicit" | "model-map"
}

export interface ModelMapController {
  clear(input: { readonly scope: ModelMapScope; readonly sessionID?: string }): Promise<void>
  deleteSession(sessionID: string): void
  list(): readonly string[]
  resolve(input: ModelMapRouteRequest): Promise<ResolvedModelMapRoute | undefined>
  show(sessionID?: string): Promise<ModelMapSelection | undefined>
  use(input: { readonly name: string; readonly scope: ModelMapScope; readonly sessionID?: string }): Promise<void>
}
