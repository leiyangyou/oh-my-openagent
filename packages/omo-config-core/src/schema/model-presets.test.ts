import { describe, expect, test } from "bun:test"

import { OmoConfigSchema } from "./config"

describe("model_presets schema", () => {
  test("#given agent and category routes #when parsing root config #then preserves strict model references and selection", () => {
    const result = OmoConfigSchema.safeParse({
      model_preset: "quality",
      model_presets: {
        quality: {
          agents: {
            explore: "fast",
          },
          categories: {
            deep: {
              model: "openai/gpt-5.6-sol",
              reasoning: "xhigh",
              temperature: 0.2,
              max_tokens: 8192,
            },
          },
        },
      },
    })

    expect(result.success).toBeTrue()
    if (!result.success) return
    expect(result.data.model_preset).toBe("quality")
    expect(result.data.model_presets?.quality?.agents?.explore).toBe("fast")
    expect(result.data.model_presets?.quality?.categories?.deep).toEqual({
      model: "openai/gpt-5.6-sol",
      reasoning: "xhigh",
      temperature: 0.2,
      max_tokens: 8192,
    })
  })

  test("#given malformed route fields #when parsing root config #then rejects the preset", () => {
    const result = OmoConfigSchema.safeParse({
      model_presets: {
        broken: {
          agents: {
            explore: { model: "openai/gpt-5.6-sol", prompt: "not routing policy" },
          },
        },
      },
    })

    expect(result.success).toBeFalse()
  })

  test("#given provider options on a modelmap route #when parsing root config #then rejects the unsupported setting", () => {
    const result = OmoConfigSchema.safeParse({
      model_presets: {
        broken: {
          agents: {
            explore: {
              model: "openai/gpt-5.6-sol",
              provider_options: { service_tier: "priority" },
            },
          },
        },
      },
    })

    expect(result.success).toBeFalse()
  })

  test("#given model presets inside a profile #when parsing root config #then rejects runtime maps as profiles", () => {
    const result = OmoConfigSchema.safeParse({
      profiles: {
        quality: {
          model_presets: {
            nested: { agents: { explore: "openai/gpt-5.6-sol" } },
          },
        },
      },
    })

    expect(result.success).toBeFalse()
  })
})
