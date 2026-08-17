import * as z from "zod"

import { OmoModelRefSchema } from "./model-ref"

export const OmoModelPresetSchema = z.object({
  agents: z.record(z.string(), OmoModelRefSchema).optional(),
  categories: z.record(z.string(), OmoModelRefSchema).optional(),
}).strict()

export const OmoModelPresetsSchema = z.record(z.string(), OmoModelPresetSchema)

export type OmoModelPreset = z.infer<typeof OmoModelPresetSchema>
export type OmoModelPresets = z.infer<typeof OmoModelPresetsSchema>
