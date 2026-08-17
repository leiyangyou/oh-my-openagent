import { expect, test } from "bun:test"
import { join } from "node:path"

test("#given the model-map feature boundary #when loading its barrel #then the isolated module exists", async () => {
  const barrel = Bun.file(join(import.meta.dir, "index.ts"))

  expect(await barrel.exists()).toBeTrue()
})

test("#given the model-map barrel #when importing it #then it exposes the controller factory", async () => {
  const module = await import("./index")

  expect(typeof Reflect.get(module, "createModelMapController")).toBe("function")
})
