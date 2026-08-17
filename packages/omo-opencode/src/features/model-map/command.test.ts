import { describe, expect, mock, test } from "bun:test"

import { executeModelMapCommand, parseModelMapCommand } from "./command"
import type { ModelMapController } from "./types"

function createController(): ModelMapController {
  return {
    clear: mock(async () => {}),
    deleteSession: mock(() => {}),
    list: mock(() => ["economy", "quality"]),
    resolve: mock(async () => undefined),
    show: mock(async () => undefined),
    use: mock(async () => {}),
  }
}

describe("parseModelMapCommand", () => {
  test("#given supported commands #when parsing #then scope defaults and flags are explicit", () => {
    expect(parseModelMapCommand("list")).toEqual({ kind: "list" })
    expect(parseModelMapCommand("show")).toEqual({ kind: "show" })
    expect(parseModelMapCommand("use quality")).toEqual({ kind: "use", name: "quality", scope: "workspace" })
    expect(parseModelMapCommand("use quality --global")).toEqual({ kind: "use", name: "quality", scope: "global" })
    expect(parseModelMapCommand("clear --session")).toEqual({ kind: "clear", scope: "session" })
  })

  test("#given unsupported arguments #when parsing #then a typed command error is thrown", () => {
    expect(() => parseModelMapCommand("use")).toThrow("Usage: /modelmap use <name> [--global|--session]")
    expect(() => parseModelMapCommand("clear --global --session")).toThrow("Choose one model-map scope")
    expect(() => parseModelMapCommand("replace quality")).toThrow("Unknown /modelmap command")
  })
})

describe("executeModelMapCommand", () => {
  test("#given use and clear commands #when executing #then controller receives the current session and parsed scope", async () => {
    const controller = createController()

    const used = await executeModelMapCommand(controller, "use quality --session", "session-1")
    const cleared = await executeModelMapCommand(controller, "clear", "session-1")

    expect(controller.use).toHaveBeenCalledWith({ name: "quality", scope: "session", sessionID: "session-1" })
    expect(controller.clear).toHaveBeenCalledWith({ scope: "workspace", sessionID: "session-1" })
    expect(used).toEqual({ action: "use", name: "quality", scope: "session" })
    expect(cleared).toEqual({ action: "clear", scope: "workspace" })
  })

  test("#given list and show commands #when executing #then results are structured for the adapter", async () => {
    const controller = createController()

    expect(await executeModelMapCommand(controller, "list", "session-1")).toEqual({
      action: "list",
      names: ["economy", "quality"],
    })
    expect(await executeModelMapCommand(controller, "show", "session-1")).toEqual({
      action: "show",
      selection: undefined,
    })
  })
})
