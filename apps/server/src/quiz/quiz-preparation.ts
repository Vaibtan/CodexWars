import { GENERAL_KNOWLEDGE_FALLBACK_V1, validateQuizTemplate } from "@codexwars/shared";
import { createEvidencePool } from "./evidence-pool.js";
import { TRUSTED_SOURCE_DOMAINS } from "./evidence-policy.js";
import type { GenerationGovernor } from "./governor.js";
import { deepFreeze } from "./deep-freeze.js";
import { addModelUsage, ZERO_MODEL_USAGE } from "./model-usage.js";
import { selectPlayableCandidate, validateGeneratedCandidate } from "./quality.js";
import { QuizModelFailure, QuizPreparationCancelledError, type ModelUsage, type PreparedQuiz, type QuizFallbackReason, type QuizModelPort, type QuizPreparation, type QuizPreparationPolicy, type QuizPreparationRequest } from "./types.js";

const MODEL = "gpt-5.4-mini-2026-03-17" as const;
const PROMPT_VERSION = "quiz-v1" as const;

interface Dependencies {
  readonly governor: GenerationGovernor;
  readonly id: () => string;
  readonly model?: QuizModelPort;
  readonly now: () => number;
  readonly policy: QuizPreparationPolicy;
}

function fallback(now: number, reason: QuizFallbackReason, usage: ModelUsage = ZERO_MODEL_USAGE): PreparedQuiz {
  const validation = validateQuizTemplate(GENERAL_KNOWLEDGE_FALLBACK_V1);
  if (!validation.ok) throw new TypeError(`Invalid curated fallback: ${validation.reason}`);
  return deepFreeze({
    provenance: { fallbackReason: reason, generatedAt: now, model: MODEL, promptVersion: PROMPT_VERSION, usage },
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
  const evidencePool = createEvidencePool({
    maxEntries: dependencies.policy.evidenceCacheMaxEntries,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    sourcePolicy: TRUSTED_SOURCE_DOMAINS,
    ttlMs: dependencies.policy.evidenceCacheTtlMs
  });
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
      const model = dependencies.model;
      if (model === undefined) return fallback(now, "generation_disabled");
      if (now < circuitOpenedUntil) return fallback(now, "circuit_open");
      const permit = dependencies.governor.acquire(now);
      if (permit === undefined) return fallback(now, "budget_exhausted");

      const deadline = combinedSignal(externalSignal, dependencies.policy.deadlineMs);
      const modelRequest = { configuration: request.configuration, now, roomId: request.roomId, roundId: request.roundId };
      try {
        const acquisition = await evidencePool.acquire(model, modelRequest, deadline.signal, permit);
        if (acquisition.status === "budget_exhausted") return fallback(now, "budget_exhausted");
        if (acquisition.status === "failed") {
          if (externalSignal.aborted) throw new QuizPreparationCancelledError();
          if (deadline.timedOut()) {
            providerFailed(now);
            return fallback(now, "timeout", acquisition.usage);
          }
          providerFailed(now);
          return fallback(now, normalizedFailure(acquisition.cause), acquisition.usage);
        }
        const evidence = acquisition.evidence;
        const evidenceUsage = acquisition.usage;
        let generation;
        let lastFailure: unknown;
        for (let attempt = 0; attempt <= dependencies.policy.retryLimit; attempt += 1) {
          try {
            generation = await model.generate(modelRequest, evidence, deadline.signal);
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
          return fallback(now, "timeout", evidenceUsage);
        }
        if (generation === undefined) {
          providerFailed(now);
          return fallback(now, normalizedFailure(lastFailure), evidenceUsage);
        }
        const candidate = generation.value;
        const generationUsage = addModelUsage(evidenceUsage, generation.usage);

        let reviewStage;
        try {
          reviewStage = await model.review(candidate, evidence, modelRequest, deadline.signal);
        } catch (error) {
          if (externalSignal.aborted) throw new QuizPreparationCancelledError();
          if (deadline.timedOut()) {
            providerFailed(now);
            return fallback(now, "timeout", generationUsage);
          }
          providerFailed(now);
          return fallback(now, normalizedFailure(error), generationUsage);
        }
        const review = reviewStage.value;
        const selection = selectPlayableCandidate(candidate, review, request.configuration);
        const reviewUsage = { ...reviewStage.usage, searchCalls: 0 };
        const totalUsage = addModelUsage(generationUsage, reviewUsage);
        if (selection === undefined) return fallback(now, "validation_failed", totalUsage);
        const validated = validateGeneratedCandidate(selection.candidate, selection.review, request.configuration, now, dependencies.policy.developingStoryCutoffMs, `generated:${dependencies.id()}`);
        if (!validated.ok) return fallback(now, "validation_failed", totalUsage);

        consecutiveProviderFailures = 0;

        return deepFreeze({
          provenance: {
            generatedAt: now,
            model: MODEL,
            promptVersion: PROMPT_VERSION,
            usage: totalUsage
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
