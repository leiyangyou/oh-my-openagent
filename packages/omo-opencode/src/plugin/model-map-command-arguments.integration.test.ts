import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createModelMapController, executeModelMapCommand } from "../features/model-map"
import { createCommandExecuteBeforeHandler } from "./command-execute-before"

let temporaryDirectory: string | undefined

afterEach(() => {
  if (temporaryDirectory !== undefined) rmSync(temporaryDirectory, { recursive: true, force: true })
  temporaryDirectory = undefined
})

describe("modelmap OpenCode command arguments", () => {
  test("#given JSON-quoted CLI arguments #when the real command handler activates a preset #then the controller exposes the session selection", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "model-map-command-arguments-"))
    const directory = join(temporaryDirectory, "workspace")
    mkdirSync(join(directory, ".omo"), { recursive: true })
    writeFileSync(join(directory, ".omo", "omo.jsonc"), `{
  "model_presets": { "quality": { "agents": { "metis": "openai/deep" } } }
}`)
    const controller = createModelMapController({
      directory,
      environment: { HOME: temporaryDirectory },
      session: { get: async () => ({ data: {} }) },
    })
    const handler = createCommandExecuteBeforeHandler({
      directory,
      hooks: {},
      modelMapCommand: {
        execute: (argumentsText, sessionID) => executeModelMapCommand(controller, argumentsText, sessionID),
      },
    })
    const output: { parts: Array<{ type: string; text?: string; [key: string]: unknown }> } = { parts: [] }

    await handler({
      command: "modelmap",
      sessionID: "root",
      arguments: JSON.stringify("use quality --session"),
    }, output)

    expect(output.parts).toEqual([{
      type: "text",
      text: '{"action":"use","name":"quality","scope":"session"}',
      synthetic: true,
      modelMap: true,
    }])
    expect(await controller.show("root")).toMatchObject({ name: "quality", revision: 1, scope: "session" })
  })
})
