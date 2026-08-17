import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createModelMapController } from "../features/model-map"

let temporaryDirectory: string | undefined

afterEach(() => {
  if (temporaryDirectory !== undefined) rmSync(temporaryDirectory, { recursive: true, force: true })
  temporaryDirectory = undefined
})

describe("modelmap unified config loading", () => {
  test("#given a free-form opencode block #when the real controller resolves active routes #then model presets survive shared config loading", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "model-map-config-loading-"))
    const directory = join(temporaryDirectory, "workspace")
    mkdirSync(join(directory, ".omo"), { recursive: true })
    writeFileSync(join(directory, ".omo", "omo.jsonc"), `{
  "model_preset": "economy",
  "model_presets": {
    "economy": {
      "agents": { "metis": "openai/fast" },
      "categories": { "quick": "openai/quick" }
    },
    "quality": { "agents": { "metis": "openai/deep" } }
  },
  "[opencode]": {
    "disabled_hooks": ["auto-update-checker"],
    "agents": { "metis": { "model": "openai/base" } }
  }
}`)
    const controller = createModelMapController({
      directory,
      environment: { HOME: temporaryDirectory },
      session: { get: async () => ({ data: {} }) },
    })

    const direct = await controller.resolve({
      baseModel: { providerID: "openai", modelID: "base" },
      key: "metis",
      kind: "agent",
      sessionID: "root",
    })
    const category = await controller.resolve({
      baseModel: { providerID: "openai", modelID: "base" },
      key: "quick",
      kind: "category",
      sessionID: "root",
    })

    expect(controller.list()).toEqual(["economy", "quality"])
    expect(direct).toMatchObject({ model: { providerID: "openai", modelID: "fast" }, source: "model-map" })
    expect(category).toMatchObject({ model: { providerID: "openai", modelID: "quick" }, source: "model-map" })
  })
})
