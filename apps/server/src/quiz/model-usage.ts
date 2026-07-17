import type { ModelUsage } from "./types.js";

export const ZERO_MODEL_USAGE: ModelUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  searchCalls: 0
});

export function addModelUsage(...values: readonly ModelUsage[]): ModelUsage {
  return values.reduce<ModelUsage>((total, value) => ({
    inputTokens: total.inputTokens + value.inputTokens,
    outputTokens: total.outputTokens + value.outputTokens,
    searchCalls: total.searchCalls + value.searchCalls
  }), ZERO_MODEL_USAGE);
}
