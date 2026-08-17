import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { createModelMapController } from "./controller"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createFixture() {
  const home = mkdtempSync(join(tmpdir(), "model-map-controller-"))
  temporaryDirectories.push(home)
  const directory = join(home, "workspace")
  mkdirSync(join(home, ".omo"), { recursive: true })
  mkdirSync(join(directory, ".omo"), { recursive: true })
  writeFileSync(join(home, ".omo", "omo.jsonc"), `// user comment
{
  "codegraph": { "daemon": false },
  "model_preset": "economy",
  "model_presets": {
    "economy": {
      "agents": { "explore": "openai/gpt-5.6-luna-fast" },
      "categories": { "deep": "openai/gpt-5.5" }
    },
    "quality": {
      "agents": { "explore": { "model": "openai/gpt-5.6-sol", "reasoning": "high" } },
      "categories": { "deep": { "model": "anthropic/claude-opus-5", "reasoning": "max" } }
    }
  }
}
`)
  writeFileSync(join(directory, ".omo", "omo.jsonc"), `// workspace comment
{
  "model_preset": "quality",
  "task": { "default_concurrency": 3 }
}
`)
  const parents = new Map<string, string | undefined>([
    ["root", undefined],
    ["child", "root"],
    ["grandchild", "child"],
  ])
  const controller = createModelMapController({
    directory,
    environment: { HOME: home },
    session: {
      get: async ({ path }) => ({ data: { parentID: parents.get(path.id) } }),
    },
  })
  return { controller, directory, home }
}

describe("createModelMapController", () => {
  test("#given global and workspace selections #when listing and showing #then workspace wins with the named preset", async () => {
    const { controller } = createFixture()

    expect(controller.list()).toEqual(["economy", "quality"])
    expect(await controller.show("root")).toMatchObject({
      name: "quality",
      revision: 0,
      scope: "workspace",
    })
  })

  test("#given an existing descendant #when ancestor selections change and clear #then lookup stays dynamic and reveals lower scope", async () => {
    const { controller } = createFixture()
    await controller.use({ name: "economy", scope: "session", sessionID: "root" })
    const inherited = await controller.show("grandchild")
    await controller.use({ name: "quality", scope: "session", sessionID: "child" })
    const overridden = await controller.show("grandchild")
    await controller.clear({ scope: "session", sessionID: "child" })
    const revealed = await controller.show("grandchild")
    await controller.clear({ scope: "session", sessionID: "root" })
    const workspace = await controller.show("grandchild")

    expect(inherited).toMatchObject({ name: "economy", revision: 1, scope: "session" })
    expect(overridden).toMatchObject({ name: "quality", revision: 2, scope: "session" })
    expect(revealed).toMatchObject({ name: "economy", revision: 3, scope: "session" })
    expect(workspace).toMatchObject({ name: "quality", revision: 4, scope: "workspace" })
  })

  test("#given persisted JSONC #when global and workspace selections change #then comments and unrelated keys survive", async () => {
    const { controller, directory, home } = createFixture()

    await controller.use({ name: "quality", scope: "global" })
    await controller.use({ name: "economy", scope: "workspace" })

    const userContent = readFileSync(join(home, ".omo", "omo.jsonc"), "utf-8")
    const workspaceContent = readFileSync(join(directory, ".omo", "omo.jsonc"), "utf-8")
    expect(userContent).toContain("// user comment")
    expect(userContent).toContain('"daemon": false')
    expect(userContent).toContain('"model_preset": "quality"')
    expect(workspaceContent).toContain("// workspace comment")
    expect(workspaceContent).toContain('"default_concurrency": 3')
    expect(workspaceContent).toContain('"model_preset": "economy"')
  })

  test("#given an unknown preset #when activation fails #then persisted and effective selections remain unchanged", async () => {
    const { controller } = createFixture()

    await expect(controller.use({ name: "missing", scope: "workspace" })).rejects.toThrow(
      'Unknown model preset "missing"',
    )
    expect(await controller.show("root")).toMatchObject({ name: "quality", revision: 0, scope: "workspace" })
  })

  test("#given inherited object keys #when activation is attempted #then each key remains an unknown preset", async () => {
    const { controller } = createFixture()

    for (const name of ["toString", "constructor"]) {
      await expect(controller.use({ name, scope: "session", sessionID: "root" })).rejects.toThrow(
        `Unknown model preset "${name}"`,
      )
    }
  })

  test("#given explicit mapped and base candidates #when resolving routes #then precedence and route kind stay distinct", async () => {
    const { controller } = createFixture()
    await controller.use({ name: "quality", scope: "session", sessionID: "root" })
    const fallbackChain = [{ model: "openai/gpt-5.5", providers: ["openai"] }]

    const direct = await controller.resolve({
      baseModel: { providerID: "base", modelID: "agent" },
      fallbackChain,
      key: "explore",
      kind: "agent",
      sessionID: "child",
    })
    const category = await controller.resolve({
      baseModel: { providerID: "base", modelID: "category" },
      key: "deep",
      kind: "category",
      sessionID: "child",
    })
    const explicit = await controller.resolve({
      baseModel: { providerID: "base", modelID: "agent" },
      explicitModel: { providerID: "explicit", modelID: "pinned" },
      key: "explore",
      kind: "agent",
      sessionID: "child",
    })

    expect(direct).toMatchObject({
      concurrencyKey: "openai/gpt-5.6-sol",
      fallbackChain,
      mappedKey: "explore",
      model: { providerID: "openai", modelID: "gpt-5.6-sol", reasoning: "high" },
      presetName: "quality",
      revision: 1,
      scope: "session",
      source: "model-map",
    })
    expect(category?.model).toMatchObject({ providerID: "anthropic", modelID: "claude-opus-5", reasoning: "max" })
    expect(explicit).toMatchObject({
      concurrencyKey: "explicit/pinned",
      model: { providerID: "explicit", modelID: "pinned" },
      scope: "explicit",
      source: "explicit",
    })
  })

  test("#given a missing mapped key #when resolving #then base routing is returned", async () => {
    const { controller } = createFixture()

    const route = await controller.resolve({
      baseModel: { providerID: "base", modelID: "unchanged" },
      key: "librarian",
      kind: "agent",
      sessionID: "root",
    })

    expect(route).toMatchObject({
      concurrencyKey: "base/unchanged",
      model: { providerID: "base", modelID: "unchanged" },
      revision: 0,
      scope: "base",
      source: "base",
    })
  })

  test("#given a captured route #when selection changes #then the current dispatch stays pinned and the next sees a new revision", async () => {
    const { controller } = createFixture()
    await controller.use({ name: "economy", scope: "session", sessionID: "root" })
    const current = await controller.resolve({ key: "explore", kind: "agent", sessionID: "root" })
    await controller.use({ name: "quality", scope: "session", sessionID: "root" })
    const next = await controller.resolve({ key: "explore", kind: "agent", sessionID: "root" })

    expect(current).toMatchObject({
      model: { providerID: "openai", modelID: "gpt-5.6-luna-fast" },
      revision: 1,
    })
    expect(next).toMatchObject({
      model: { providerID: "openai", modelID: "gpt-5.6-sol" },
      revision: 2,
    })
  })

  test("#given local session state #when the session is deleted #then descendants reveal persisted scope", async () => {
    const { controller } = createFixture()
    await controller.use({ name: "economy", scope: "session", sessionID: "root" })

    controller.deleteSession("root")

    expect(await controller.show("child")).toMatchObject({ name: "quality", scope: "workspace" })
  })
})
