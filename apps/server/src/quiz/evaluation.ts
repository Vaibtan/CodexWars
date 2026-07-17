import { QUIZ_CATEGORIES, QUIZ_CONTENT_MODES, QUIZ_DIFFICULTY_PROFILES, type QuizConfiguration } from "@codexwars/shared";

export interface QuizEvaluationCase {
  readonly id: string;
  readonly configuration: QuizConfiguration;
}

export const QUIZ_EVALUATION_THRESHOLDS = Object.freeze({
  ambiguityRateMax: 0.02,
  estimatedCostUsdMax: 0.05,
  factualCorrectnessMin: 0.98,
  fallbackRateMax: 0.1,
  latencyP95MsMax: 20_000,
  sourceQualityMin: 0.95,
  unsafeContentRateMax: 0
});

export const QUIZ_EVALUATION_V1: readonly QuizEvaluationCase[] = Object.freeze(
  QUIZ_CONTENT_MODES.flatMap((contentMode) =>
    QUIZ_CATEGORIES.flatMap((category) =>
      QUIZ_DIFFICULTY_PROFILES.map((difficultyProfile) => ({
        configuration: { category, contentMode, currentEventsLookbackDays: 14 as const, difficultyProfile },
        id: `v1:${contentMode}:${category}:${difficultyProfile}`
      }))
    )
  )
);
