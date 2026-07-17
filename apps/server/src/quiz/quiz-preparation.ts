import { GENERAL_KNOWLEDGE_FALLBACK_V1, validateQuizTemplate } from "@codexwars/shared";
import type { GenerationGovernor } from "./governor.js";
import { selectPlayableCandidate, validateGeneratedCandidate } from "./quality.js";
import { QuizModelFailure, QuizPreparationCancelledError, type ModelUsage, type PreparedQuiz, type QuizFallbackReason, type QuizModelPort, type QuizPreparation, type QuizPreparationPolicy, type QuizPreparationRequest } from "./types.js";

const MODEL = "gpt-5.4-mini-2026-03-17" as const;
const PROMPT_VERSION = "quiz-v1" as const;
const ZERO_USAGE: ModelUsage = { inputTokens: 0, outputTokens: 0, searchCalls: 0 };

interface Dependencies {
  readonly governor: GenerationGovernor;
  readonly id: () => string;
  readonly model?: QuizModelPort;
  readonly now: () => number;
  readonly policy: QuizPreparationPolicy;
}

function frozen<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) frozen(child);
  return value;
}

function fallback(now: number, reason: QuizFallbackReason): PreparedQuiz {
  const validation = validateQuizTemplate(GENERAL_KNOWLEDGE_FALLBACK_V1);
  if (!validation.ok) throw new TypeError(`Invalid curated fallback: ${validation.reason}`);
  return frozen({
    provenance: { fallbackReason: reason, generatedAt: now, model: MODEL, promptVersion: PROMPT_VERSION, usage: ZERO_USAGE },
    source: "fallback",
    sources: [],
    template: structuredClone(GENERAL_KNOWLEDGE_FALLBACK_V1)
  });
}

function normalizedFailure(error: unknown): QuizFallbackReason {
  return error instanceof QuizModelFailure ? error.reason : "upstream_unavailable";
}

function combinedSignal(external: AbortSignal, deadlineMs: number): { readonly clear: () => void; readonly signal: AbortSignal; readonly timedOut: () => boolean } {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), deadlineMs);
  return { clear: () => clearTimeout(timer), signal: AbortSignal.any([external, deadline.signal]), timedOut: () => deadline.signal.aborted };
}

export function createQuizPreparation(dependencies: Dependencies): QuizPreparation {
  let circuitOpenedUntil = 0;
  let consecutiveProviderFailures = 0;
  const failureThreshold = dependencies.policy.circuitFailureThreshold ?? 3;
  const circuitCooldownMs = dependencies.policy.circuitCooldownMs ?? 60_000;
  const providerFailed = (at: number): void => {
    consecutiveProviderFailures += 1;
    if (consecutiveProviderFailures >= failureThreshold) circuitOpenedUntil = at + circuitCooldownMs;
  };
  return {
    async prepare(request: QuizPreparationRequest, externalSignal: AbortSignal): Promise<PreparedQuiz> {
      if (externalSignal.aborted) throw new QuizPreparationCancelledError();
      const now = dependencies.now();
      if (dependencies.model === undefined) return fallback(now, "generation_disabled");
      if (now < circuitOpenedUntil) return fallback(now, "circuit_open");
      const permit = dependencies.governor.acquire(now);
      if (permit === undefined) return fallback(now, "budget_exhausted");

      const deadline = combinedSignal(externalSignal, dependencies.policy.deadlineMs);
      const modelRequest = { configuration: request.configuration, now, roomId: request.roomId, roundId: request.roundId };
      try {
        let candidate;
        let lastFailure: unknown;
        for (let attempt = 0; attempt <= dependencies.policy.retryLimit; attempt += 1) {
          try {
            candidate = await dependencies.model.generate(modelRequest, deadline.signal);
            break;
          } catch (error) {
            lastFailure = error;
            if (deadline.signal.aborted) break;
            if (!(error instanceof QuizModelFailure) || !error.transient || attempt === dependencies.policy.retryLimit) break;
          }
        }
        if (externalSignal.aborted) throw new QuizPreparationCancelledError();
        if (deadline.timedOut()) {
          providerFailed(now);
          return fallback(now, "timeout");
        }
        if (candidate === undefined) {
          providerFailed(now);
          return fallback(now, normalizedFailure(lastFailure));
        }
        if (!permit.recordSearchCalls(candidate.usage?.searchCalls ?? 0)) return fallback(now, "budget_exhausted");

        let review;
        try {
          review = await dependencies.model.review(candidate, modelRequest, deadline.signal);
        } catch (error) {
          if (externalSignal.aborted) throw new QuizPreparationCancelledError();
          if (deadline.timedOut()) {
            providerFailed(now);
            return fallback(now, "timeout");
          }
          providerFailed(now);
          return fallback(now, normalizedFailure(error));
        }
        const selection = selectPlayableCandidate(candidate, review, request.configuration);
        if (selection === undefined) return fallback(now, "validation_failed");
        const validated = validateGeneratedCandidate(selection.candidate, selection.review, request.configuration, now, dependencies.policy.developingStoryCutoffMs, `generated:${dependencies.id()}`);
        if (!validated.ok) return fallback(now, "validation_failed");

        consecutiveProviderFailures = 0;

        const generationUsage = candidate.usage ?? ZERO_USAGE;
        const reviewUsage = review.usage ?? { inputTokens: 0, outputTokens: 0 };
        return frozen({
          provenance: {
            generatedAt: now,
            model: MODEL,
            promptVersion: PROMPT_VERSION,
            usage: { inputTokens: generationUsage.inputTokens + reviewUsage.inputTokens, outputTokens: generationUsage.outputTokens + reviewUsage.outputTokens, searchCalls: generationUsage.searchCalls }
          },
          source: "generated",
          sources: validated.sources,
          template: validated.template
        });
      } finally {
        deadline.clear();
        permit.release();
      }
    }
  };
}
