import type { ModelMapScope } from "./types"

export class UnknownModelPresetError extends Error {
  override readonly name = "UnknownModelPresetError"

  constructor(readonly presetName: string) {
    super(`Unknown model preset "${presetName}"`)
  }
}

export class MissingModelMapSessionError extends Error {
  override readonly name = "MissingModelMapSessionError"

  constructor(readonly scope: ModelMapScope) {
    super(`Model-map scope "${scope}" requires a session ID`)
  }
}

export class InvalidModelMapRouteError extends Error {
  override readonly name = "InvalidModelMapRouteError"

  constructor(readonly model: string) {
    super(`Model-map route "${model}" must include a provider and model ID`)
  }
}
