import * as z from "zod"

import { OmoModelRefObjectSchema } from "./model-ref"

const OmoModelMapRefSchema = z.union([
  z.string(),
  OmoModelRefObjectSchema.omit({ provider_options: true }),
])

export const OmoModelPresetSchema = z.object({
  agents: z.record(z.string(), OmoModelMapRefSchema).optional(),
  categories: z.record(z.string(), OmoModelMapRefSchema).optional(),
}).strict()

export const OmoModelPresetsSchema = z.record(z.string(), OmoModelPresetSchema)

export type OmoModelPreset = z.infer<typeof OmoModelPresetSchema>
export type OmoModelPresets = z.infer<typeof OmoModelPresetsSchema>
