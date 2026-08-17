import type { OmoConfigEnv, OmoModelPreset } from "@oh-my-opencode/omo-config-core"

import { loadPersistentModelMapState, writePersistentModelMapSelection } from "./config-state"
import { MissingModelMapSessionError, UnknownModelPresetError } from "./errors"
import { resolveModelMapRoute } from "./route-resolution"
import { findInheritedSessionID } from "./session-lineage"
import type { ModelMapController, ModelMapScope, ModelMapSelection } from "./types"

export type ModelMapSessionClient = {
  readonly get: (input: { readonly path: { readonly id: string } }) => Promise<{
    readonly data?: { readonly parentID?: string }
  }>
}

export type CreateModelMapControllerOptions = {
  readonly directory: string
  readonly environment?: OmoConfigEnv
  readonly session: ModelMapSessionClient
}

type SessionSelection = {
  readonly name: string
  readonly revision: number
}

function ownPreset(
  presets: Readonly<Record<string, OmoModelPreset>>,
  name: string,
): OmoModelPreset | undefined {
  return Object.hasOwn(presets, name) ? presets[name] : undefined
}

function persistentSelection(
  state: ReturnType<typeof loadPersistentModelMapState>,
): { readonly name: string; readonly preset: OmoModelPreset; readonly scope: ModelMapScope } | undefined {
  const name = state.workspacePreset ?? state.globalPreset
  if (name === undefined) return undefined
  const preset = ownPreset(state.presets, name)
  if (preset === undefined) return undefined
  return { name, preset, scope: state.workspacePreset === undefined ? "global" : "workspace" }
}

export function createModelMapController(options: CreateModelMapControllerOptions): ModelMapController {
  const context = {
    directory: options.directory,
    ...(options.environment === undefined ? {} : { environment: options.environment }),
  }
  const sessions = new Map<string, SessionSelection>()
  let revision = 0

  async function show(sessionID?: string): Promise<ModelMapSelection | undefined> {
    const state = loadPersistentModelMapState(context)
    if (sessionID !== undefined) {
      const inheritedID = await findInheritedSessionID(sessionID, sessions, options.session)
      const selected = inheritedID === undefined ? undefined : sessions.get(inheritedID)
      const preset = selected === undefined ? undefined : ownPreset(state.presets, selected.name)
      if (selected !== undefined && preset !== undefined) {
        return { name: selected.name, preset, revision, scope: "session" }
      }
    }

    const persistent = persistentSelection(state)
    return persistent === undefined ? undefined : { ...persistent, revision }
  }

  function requireSessionID(scope: ModelMapScope, sessionID?: string): string {
    if (sessionID !== undefined) return sessionID
    throw new MissingModelMapSessionError(scope)
  }

  return {
    clear: async ({ scope, sessionID }) => {
      revision += 1
      if (scope === "session") {
        sessions.delete(requireSessionID(scope, sessionID))
        return
      }
      writePersistentModelMapSelection(context, scope, undefined)
    },
    deleteSession: (sessionID) => {
      sessions.delete(sessionID)
    },
    list: () => Object.keys(loadPersistentModelMapState(context).presets).sort(),
    resolve: async (input) => resolveModelMapRoute(input, await show(input.sessionID)),
    show,
    use: async ({ name, scope, sessionID }) => {
      const state = loadPersistentModelMapState(context)
      if (ownPreset(state.presets, name) === undefined) throw new UnknownModelPresetError(name)
      revision += 1
      if (scope === "session") {
        sessions.set(requireSessionID(scope, sessionID), { name, revision })
        return
      }
      writePersistentModelMapSelection(context, scope, name)
    },
  }
}
