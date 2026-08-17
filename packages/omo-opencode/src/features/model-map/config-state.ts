import {
  loadOmoConfig,
  resolveModelReferences,
  updateOmoConfig,
  type OmoConfigEnv,
  type OmoModelPresets,
} from "@oh-my-opencode/omo-config-core"

import type { ModelMapScope } from "./types"

export type PersistentModelMapState = {
  readonly globalPreset?: string
  readonly presets: OmoModelPresets
  readonly workspacePreset?: string
}

export type ModelMapConfigContext = {
  readonly directory: string
  readonly environment?: OmoConfigEnv
}

function selectedPreset(config: Readonly<Record<string, unknown>>): string | undefined {
  const value = config["model_preset"]
  return typeof value === "string" ? value : undefined
}

export function loadPersistentModelMapState(context: ModelMapConfigContext): PersistentModelMapState {
  const loaded = loadOmoConfig({
    cwd: context.directory,
    harness: "opencode",
    ...(context.environment === undefined ? {} : { env: context.environment }),
  })
  const resolved = resolveModelReferences(loaded.config).view
  let globalPreset: string | undefined
  let workspacePreset: string | undefined

  for (const layer of loaded.layers) {
    const selection = selectedPreset(layer.config)
    if (selection === undefined) continue
    if (layer.source.scope === "user") globalPreset = selection
    if (layer.source.scope === "project") workspacePreset = selection
  }

  return {
    ...(globalPreset === undefined ? {} : { globalPreset }),
    presets: resolved.model_presets ?? {},
    ...(workspacePreset === undefined ? {} : { workspacePreset }),
  }
}

export function writePersistentModelMapSelection(
  context: ModelMapConfigContext,
  scope: Exclude<ModelMapScope, "session">,
  presetName: string | undefined,
): void {
  updateOmoConfig({
    edits: [{ path: ["model_preset"], value: presetName }],
    ...(context.environment === undefined ? {} : { env: context.environment }),
    ...(scope === "workspace" ? { projectDir: context.directory } : {}),
    scope: scope === "global" ? "user" : "project",
  })
}
