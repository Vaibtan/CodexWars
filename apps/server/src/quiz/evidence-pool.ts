import type { GenerationPermit } from "./governor.js";
import { deepFreeze } from "./deep-freeze.js";
import { ZERO_MODEL_USAGE } from "./model-usage.js";
import type { ModelEvidence, ModelUsage, QuizModelPort, QuizModelRequest } from "./types.js";

const SEARCH_CALLS_PER_DISCOVERY = 1;

export type EvidenceAcquisition =
  | { readonly evidence: ModelEvidence; readonly status: "ready"; readonly usage: ModelUsage }
  | { readonly status: "budget_exhausted" }
  | { readonly cause: unknown; readonly status: "failed"; readonly usage: ModelUsage };

interface EvidencePoolOptions {
  readonly maxEntries: number;
  readonly model: string;
  readonly promptVersion: string;
  readonly sourcePolicy: readonly string[];
  readonly ttlMs: number;
}

type EvidenceFlightResult =
  | { readonly evidence: ModelEvidence; readonly status: "ready" }
  | { readonly cause: unknown; readonly status: "failed" };

type EvidenceWaitResult = EvidenceFlightResult | { readonly cause: unknown; readonly status: "cancelled" };

interface EvidenceFlight {
  readonly controller: AbortController;
  readonly promise: Promise<EvidenceFlightResult>;
  settled: boolean;
  subscribers: number;
  usageClaimed: boolean;
}

export interface EvidencePool {
  acquire(
    model: QuizModelPort,
    request: QuizModelRequest,
    signal: AbortSignal,
    permit: GenerationPermit
  ): Promise<EvidenceAcquisition>;
}

function cacheKey(request: QuizModelRequest, options: EvidencePoolOptions): string {
  return JSON.stringify({
    bucket: Math.floor(request.now / options.ttlMs),
    configuration: [
      request.configuration.contentMode,
      request.configuration.category,
      request.configuration.difficultyProfile,
      request.configuration.currentEventsLookbackDays
    ],
    model: options.model,
    promptVersion: options.promptVersion,
    sourcePolicy: options.sourcePolicy
  });
}

function claimUsage(flight: EvidenceFlight, usage: ModelUsage): ModelUsage {
  if (flight.usageClaimed) return ZERO_MODEL_USAGE;
  flight.usageClaimed = true;
  return usage;
}

export function createEvidencePool(options: EvidencePoolOptions): EvidencePool {
  const cache = new Map<string, { readonly evidence: ModelEvidence; readonly expiresAt: number }>();
  const flights = new Map<string, EvidenceFlight>();

  const store = (key: string, evidence: ModelEvidence, now: number): void => {
    cache.set(key, {
      evidence: deepFreeze(evidence),
      expiresAt: Math.min(now + options.ttlMs, (Math.floor(now / options.ttlMs) + 1) * options.ttlMs)
    });
    while (cache.size > options.maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) return;
      cache.delete(oldest);
    }
  };

  const waitForFlight = (key: string, flight: EvidenceFlight, signal: AbortSignal): Promise<EvidenceWaitResult> => {
    if (signal.aborted) return Promise.resolve({ cause: signal.reason, status: "cancelled" });
    flight.subscribers += 1;
    return new Promise<EvidenceWaitResult>((resolve) => {
      let finished = false;
      const cleanup = (): void => {
        if (finished) return;
        finished = true;
        signal.removeEventListener("abort", cancelled);
        flight.subscribers -= 1;
        if (flight.subscribers === 0 && !flight.settled) {
          if (flights.get(key) === flight) flights.delete(key);
          flight.controller.abort();
        }
      };
      const cancelled = (): void => {
        cleanup();
        resolve({ cause: signal.reason, status: "cancelled" });
      };
      signal.addEventListener("abort", cancelled, { once: true });
      void flight.promise.then((result) => {
        cleanup();
        resolve(result);
      });
    });
  };

  return {
    async acquire(model, request, signal, permit) {
      if (signal.aborted) return { cause: signal.reason, status: "failed", usage: ZERO_MODEL_USAGE };
      const key = cacheKey(request, options);
      const cached = cache.get(key);
      if (cached !== undefined && cached.expiresAt > request.now) {
        cache.delete(key);
        cache.set(key, cached);
        return { evidence: cached.evidence, status: "ready", usage: ZERO_MODEL_USAGE };
      }
      if (cached !== undefined) cache.delete(key);

      let flight = flights.get(key);
      if (flight === undefined) {
        if (!permit.reserveSearchCalls(SEARCH_CALLS_PER_DISCOVERY)) return { status: "budget_exhausted" };
        const controller = new AbortController();
        const promise = model.discover(request, controller.signal).then<EvidenceFlightResult, EvidenceFlightResult>(
          (evidence) => {
            if (!controller.signal.aborted) store(key, evidence, request.now);
            return { evidence, status: "ready" };
          },
          (cause: unknown) => ({ cause, status: "failed" })
        );
        const created: EvidenceFlight = {
          controller,
          promise,
          settled: false,
          subscribers: 0,
          usageClaimed: false
        };
        void promise.then(() => {
          created.settled = true;
          if (flights.get(key) === created) flights.delete(key);
        });
        flights.set(key, created);
        flight = created;
      }

      const result = await waitForFlight(key, flight, signal);
      if (result.status === "ready") {
        return {
          evidence: result.evidence,
          status: "ready",
          usage: claimUsage(flight, {
            ...result.evidence.usage,
            searchCalls: Math.max(SEARCH_CALLS_PER_DISCOVERY, result.evidence.usage.searchCalls)
          })
        };
      }
      const usage = result.status === "cancelled" && flight.subscribers > 0
        ? ZERO_MODEL_USAGE
        : claimUsage(flight, { ...ZERO_MODEL_USAGE, searchCalls: SEARCH_CALLS_PER_DISCOVERY });
      return { cause: result.cause, status: "failed", usage };
    }
  };
}
