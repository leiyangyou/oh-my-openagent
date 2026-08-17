import {
  loadOmoConfig,
  mergeOmoConfigRecords,
  OmoConfigSchema,
  resolveModelReferences,
  resolveOmoConfigView,
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

const ModelMapConfigSchema = OmoConfigSchema.pick({
  model_preset: true,
  model_presets: true,
  models: true,
})

function modelMapConfigInput(config: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    ["model_preset", "model_presets", "models"].flatMap((key) => Object.hasOwn(config, key) ? [[key, config[key]]] : []),
  )
}

function selectedPreset(config: Readonly<Record<string, unknown>>): string | undefined {
  const value = config["model_preset"]
  return typeof value === "string" ? value : undefined
}

export function loadPersistentModelMapState(context: ModelMapConfigContext): PersistentModelMapState {
  const loaded = loadOmoConfig({
    cwd: context.directory,
    ...(context.environment === undefined ? {} : { env: context.environment }),
  })
  const merged = loaded.layers.reduce<Record<string, unknown>>(
    (config, layer) => mergeOmoConfigRecords(config, layer.config),
    {},
  )
  const resolvedView = resolveOmoConfigView({
    config: merged,
    harness: "opencode",
    ...(loaded.profile === undefined ? {} : { profile: loaded.profile }),
  })
  const parsed = ModelMapConfigSchema.safeParse(modelMapConfigInput(resolvedView.config))
  const resolved = parsed.success ? resolveModelReferences(parsed.data).view : {}
  let globalPreset: string | undefined
  let workspacePreset: string | undefined

  for (const layer of loaded.layers) {
    const view = resolveOmoConfigView({
      config: layer.config,
      harness: "opencode",
      ...(loaded.profile === undefined ? {} : { profile: loaded.profile }),
    })
    const selection = selectedPreset(view.config)
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
