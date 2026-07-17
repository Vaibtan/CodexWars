import type { QuizFallbackReason } from "./types.js";

export type QuizPreparationOutcome = "cancelled" | "generated" | QuizFallbackReason;

export interface QuizTelemetryEntry {
  readonly durationMs: number;
  readonly inputTokens: number;
  readonly outcome: QuizPreparationOutcome;
  readonly outputTokens: number;
  readonly searchCalls: number;
}

export interface QuizTelemetrySnapshot {
  readonly attempts: number;
  readonly durationMs: { readonly count: number; readonly max: number; readonly sum: number };
  readonly estimatedTextCostUsd: number;
  readonly inputTokens: number;
  readonly outcomes: Readonly<Record<string, number>>;
  readonly outputTokens: number;
  readonly searchCalls: number;
}

export interface QuizTelemetry {
  record(entry: QuizTelemetryEntry): void;
  snapshot(): QuizTelemetrySnapshot;
}

export function createQuizTelemetry(): QuizTelemetry {
  let attempts = 0;
  let durationCount = 0;
  let durationMax = 0;
  let durationSum = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let searchCalls = 0;
  const outcomes = new Map<QuizPreparationOutcome, number>();

  return {
    record(entry) {
      attempts += 1;
      durationCount += 1;
      durationMax = Math.max(durationMax, entry.durationMs);
      durationSum += entry.durationMs;
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
      searchCalls += entry.searchCalls;
      outcomes.set(entry.outcome, (outcomes.get(entry.outcome) ?? 0) + 1);
    },
    snapshot() {
      return {
        attempts,
        durationMs: { count: durationCount, max: durationMax, sum: durationSum },
        estimatedTextCostUsd: (inputTokens * 0.75 + outputTokens * 4.5) / 1_000_000,
        inputTokens,
        outcomes: Object.fromEntries([...outcomes].sort(([left], [right]) => left.localeCompare(right))),
        outputTokens,
        searchCalls
      };
    }
  };
}
