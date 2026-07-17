import { GENERAL_KNOWLEDGE_FALLBACK_V1, validateQuizTemplate } from "@codexwars/shared";
import type { GenerationGovernor, GenerationPermit } from "./governor.js";
import { selectPlayableCandidate, TRUSTED_SOURCE_DOMAINS, validateGeneratedCandidate } from "./quality.js";
import { QuizModelFailure, QuizPreparationCancelledError, type ModelEvidence, type ModelUsage, type PreparedQuiz, type QuizFallbackReason, type QuizModelPort, type QuizModelRequest, type QuizPreparation, type QuizPreparationPolicy, type QuizPreparationRequest } from "./types.js";

const MODEL = "gpt-5.4-mini-2026-03-17" as const;
const PROMPT_VERSION = "quiz-v1" as const;
const MAX_SEARCH_CALLS_PER_DISCOVERY = 1;
const ZERO_USAGE: ModelUsage = { inputTokens: 0, outputTokens: 0, searchCalls: 0 };

interface Dependencies {
  readonly governor: GenerationGovernor;
  readonly id: () => string;
  readonly model?: QuizModelPort;
  readonly now: () => number;
  readonly policy: QuizPreparationPolicy;
}

interface EvidenceFlight {
  readonly controller: AbortController;
  readonly promise: Promise<ModelEvidence>;
  settled: boolean;
  subscribers: number;
}

class EvidenceBudgetExhaustedError extends Error {}

class EvidenceLookupError extends Error {
  constructor(readonly usage: ModelUsage, cause: unknown) {
    super("evidence lookup failed", { cause });
  }
}

function frozen<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) frozen(child);
  return value;
}

function fallback(now: number, reason: QuizFallbackReason, usage: ModelUsage = ZERO_USAGE): PreparedQuiz {
  const validation = validateQuizTemplate(GENERAL_KNOWLEDGE_FALLBACK_V1);
  if (!validation.ok) throw new TypeError(`Invalid curated fallback: ${validation.reason}`);
  return frozen({
    provenance: { fallbackReason: reason, generatedAt: now, model: MODEL, promptVersion: PROMPT_VERSION, usage },
    source: "fallback",
    sources: [],
    template: structuredClone(GENERAL_KNOWLEDGE_FALLBACK_V1)
  });
}

function normalizedFailure(error: unknown): QuizFallbackReason {
  return error instanceof QuizModelFailure ? error.reason : "upstream_unavailable";
}

function addUsage(...values: readonly ModelUsage[]): ModelUsage {
  return values.reduce<ModelUsage>((total, value) => ({
    inputTokens: total.inputTokens + value.inputTokens,
    outputTokens: total.outputTokens + value.outputTokens,
    searchCalls: total.searchCalls + value.searchCalls
  }), ZERO_USAGE);
}

function combinedSignal(external: AbortSignal, deadlineMs: number): { readonly clear: () => void; readonly signal: AbortSignal; readonly timedOut: () => boolean } {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), deadlineMs);
  return { clear: () => clearTimeout(timer), signal: AbortSignal.any([external, deadline.signal]), timedOut: () => deadline.signal.aborted };
}

function evidenceCacheKey(request: QuizModelRequest, ttlMs: number): string {
  return JSON.stringify({
    bucket: Math.floor(request.now / ttlMs),
    configuration: [
      request.configuration.contentMode,
      request.configuration.category,
      request.configuration.difficultyProfile,
      request.configuration.currentEventsLookbackDays
    ],
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    sourcePolicy: TRUSTED_SOURCE_DOMAINS
  });
}

export function createQuizPreparation(dependencies: Dependencies): QuizPreparation {
  const evidenceCache = new Map<string, { readonly evidence: ModelEvidence; readonly expiresAt: number }>();
  const evidenceFlights = new Map<string, EvidenceFlight>();
  let circuitOpenedUntil = 0;
  let consecutiveProviderFailures = 0;
  const failureThreshold = dependencies.policy.circuitFailureThreshold ?? 3;
  const circuitCooldownMs = dependencies.policy.circuitCooldownMs ?? 60_000;
  const providerFailed = (at: number): void => {
    consecutiveProviderFailures += 1;
    if (consecutiveProviderFailures >= failureThreshold) circuitOpenedUntil = at + circuitCooldownMs;
  };

  const storeEvidence = (key: string, evidence: ModelEvidence, now: number): void => {
    const ttlMs = dependencies.policy.evidenceCacheTtlMs;
    evidenceCache.set(key, {
      evidence: frozen(evidence),
      expiresAt: Math.min(now + ttlMs, (Math.floor(now / ttlMs) + 1) * ttlMs)
    });
    while (evidenceCache.size > dependencies.policy.evidenceCacheMaxEntries) {
      const oldest = evidenceCache.keys().next().value;
      if (oldest === undefined) break;
      evidenceCache.delete(oldest);
    }
  };

  const awaitFlight = async (flight: EvidenceFlight, signal: AbortSignal): Promise<ModelEvidence> => {
    if (signal.aborted) throw signal.reason;
    flight.subscribers += 1;
    return new Promise<ModelEvidence>((resolve, reject) => {
      let finished = false;
      const cleanup = (): void => {
        if (finished) return;
        finished = true;
        signal.removeEventListener("abort", aborted);
        flight.subscribers -= 1;
        if (flight.subscribers === 0 && !flight.settled) flight.controller.abort();
      };
      const aborted = (): void => {
        cleanup();
        reject(signal.reason);
      };
      signal.addEventListener("abort", aborted, { once: true });
      void flight.promise.then(
        (value) => { cleanup(); resolve(value); },
        (error: unknown) => { cleanup(); reject(error); }
      );
    });
  };

  const acquireEvidence = async (model: QuizModelPort, request: QuizModelRequest, signal: AbortSignal, permit: GenerationPermit): Promise<{ readonly evidence: ModelEvidence; readonly usage: ModelUsage }> => {
    const key = evidenceCacheKey(request, dependencies.policy.evidenceCacheTtlMs);
    const cached = evidenceCache.get(key);
    if (cached !== undefined && cached.expiresAt > request.now) {
      evidenceCache.delete(key);
      evidenceCache.set(key, cached);
      return { evidence: cached.evidence, usage: ZERO_USAGE };
    }
    if (cached !== undefined) evidenceCache.delete(key);

    let flight = evidenceFlights.get(key);
    const ownsSearch = flight === undefined;
    if (flight === undefined) {
      if (!permit.reserveSearchCalls(MAX_SEARCH_CALLS_PER_DISCOVERY)) throw new EvidenceBudgetExhaustedError();
      const controller = new AbortController();
      const promise = model.discover(request, controller.signal).then((value) => {
        storeEvidence(key, value, request.now);
        return value;
      });
      const createdFlight: EvidenceFlight = {
        controller,
        promise,
        settled: false,
        subscribers: 0
      };
      const settle = (): void => {
        createdFlight.settled = true;
        if (evidenceFlights.get(key) === createdFlight) evidenceFlights.delete(key);
      };
      void promise.then(settle, settle);
      evidenceFlights.set(key, createdFlight);
      flight = createdFlight;
    }

    try {
      const evidence = await awaitFlight(flight, signal);
      return {
        evidence,
        usage: ownsSearch
          ? { ...evidence.usage, searchCalls: Math.max(MAX_SEARCH_CALLS_PER_DISCOVERY, evidence.usage.searchCalls) }
          : ZERO_USAGE
      };
    } catch (error) {
      throw new EvidenceLookupError(ownsSearch ? { ...ZERO_USAGE, searchCalls: MAX_SEARCH_CALLS_PER_DISCOVERY } : ZERO_USAGE, error);
    }
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
        let evidence;
        let evidenceUsage = ZERO_USAGE;
        try {
          const acquisition = await acquireEvidence(model, modelRequest, deadline.signal, permit);
          evidence = acquisition.evidence;
          evidenceUsage = acquisition.usage;
        } catch (error) {
          if (error instanceof EvidenceBudgetExhaustedError) return fallback(now, "budget_exhausted");
          if (externalSignal.aborted) throw new QuizPreparationCancelledError();
          const usage = error instanceof EvidenceLookupError ? error.usage : ZERO_USAGE;
          if (deadline.timedOut()) {
            providerFailed(now);
            return fallback(now, "timeout", usage);
          }
          providerFailed(now);
          return fallback(now, normalizedFailure(error instanceof EvidenceLookupError ? error.cause : error), usage);
        }
        let candidate;
        let lastFailure: unknown;
        for (let attempt = 0; attempt <= dependencies.policy.retryLimit; attempt += 1) {
          try {
            candidate = await model.generate(modelRequest, evidence, deadline.signal);
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
        if (candidate === undefined) {
          providerFailed(now);
          return fallback(now, normalizedFailure(lastFailure), evidenceUsage);
        }
        const generationUsage = addUsage(evidenceUsage, candidate.usage ?? ZERO_USAGE);

        let review;
        try {
          review = await model.review(candidate, modelRequest, deadline.signal);
        } catch (error) {
          if (externalSignal.aborted) throw new QuizPreparationCancelledError();
          if (deadline.timedOut()) {
            providerFailed(now);
            return fallback(now, "timeout", generationUsage);
          }
          providerFailed(now);
          return fallback(now, normalizedFailure(error), generationUsage);
        }
        const selection = selectPlayableCandidate(candidate, review, request.configuration);
        const reviewUsage = review.usage === undefined ? ZERO_USAGE : { ...review.usage, searchCalls: 0 };
        const totalUsage = addUsage(generationUsage, reviewUsage);
        if (selection === undefined) return fallback(now, "validation_failed", totalUsage);
        const validated = validateGeneratedCandidate(selection.candidate, selection.review, request.configuration, now, dependencies.policy.developingStoryCutoffMs, `generated:${dependencies.id()}`);
        if (!validated.ok) return fallback(now, "validation_failed", totalUsage);

        consecutiveProviderFailures = 0;

        return frozen({
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
