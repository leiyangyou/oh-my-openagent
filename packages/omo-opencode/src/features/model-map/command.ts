import type { ModelMapController, ModelMapScope, ModelMapSelection } from "./types"
import { UnknownModelPresetError } from "./errors"

export class ModelMapCommandError extends Error {
  override readonly name = "ModelMapCommandError"

  constructor(readonly usage: string) {
    super(usage)
  }
}

export type ModelMapCommand =
  | { readonly kind: "list" }
  | { readonly kind: "show" }
  | { readonly kind: "use"; readonly name: string; readonly scope: ModelMapScope }
  | { readonly kind: "clear"; readonly scope: ModelMapScope }

export type ModelMapCommandResult =
  | { readonly action: "error"; readonly code: "unknown_preset"; readonly message: string }
  | { readonly action: "list"; readonly names: readonly string[] }
  | { readonly action: "show"; readonly selection?: ModelMapSelection }
  | { readonly action: "use"; readonly name: string; readonly scope: ModelMapScope }
  | { readonly action: "clear"; readonly scope: ModelMapScope }

function parseScope(flags: readonly string[]): ModelMapScope {
  const scopes = flags.map((flag): ModelMapScope => {
    if (flag === "--global") return "global"
    if (flag === "--session") return "session"
    throw new ModelMapCommandError(`Unknown model-map scope "${flag}"`)
  })
  if (scopes.length > 1) throw new ModelMapCommandError("Choose one model-map scope")
  return scopes[0] ?? "workspace"
}

export function parseModelMapCommand(argumentsText: string): ModelMapCommand {
  const [command, ...argumentsList] = argumentsText.trim().split(/\s+/).filter(Boolean)
  switch (command) {
    case "list":
      if (argumentsList.length === 0) return { kind: "list" }
      throw new ModelMapCommandError("Usage: /modelmap list")
    case "show":
      if (argumentsList.length === 0) return { kind: "show" }
      throw new ModelMapCommandError("Usage: /modelmap show")
    case "use": {
      const [name, ...flags] = argumentsList
      if (name === undefined || name.startsWith("--")) {
        throw new ModelMapCommandError("Usage: /modelmap use <name> [--global|--session]")
      }
      return { kind: "use", name, scope: parseScope(flags) }
    }
    case "clear":
      return { kind: "clear", scope: parseScope(argumentsList) }
    default:
      throw new ModelMapCommandError("Unknown /modelmap command")
  }
}

export async function executeModelMapCommand(
  controller: ModelMapController,
  argumentsText: string,
  sessionID: string,
): Promise<ModelMapCommandResult> {
  const command = parseModelMapCommand(argumentsText)
  switch (command.kind) {
    case "list":
      return { action: "list", names: controller.list() }
    case "show": {
      const selection = await controller.show(sessionID)
      return selection === undefined ? { action: "show" } : { action: "show", selection }
    }
    case "use":
      try {
        await controller.use({ name: command.name, scope: command.scope, sessionID })
        return { action: "use", name: command.name, scope: command.scope }
      } catch (error) {
        if (error instanceof UnknownModelPresetError) {
          return { action: "error", code: "unknown_preset", message: error.message }
        }
        throw error
      }
    case "clear":
      await controller.clear({ scope: command.scope, sessionID })
      return { action: "clear", scope: command.scope }
  }
}
