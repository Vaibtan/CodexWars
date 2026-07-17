import { describe, expect, it, vi } from "vitest";
import type { QuizConfiguration, RoomId } from "@codexwars/shared";
import { createGenerationGovernor } from "../src/quiz/governor.js";
import { createQuizPreparation } from "../src/quiz/quiz-preparation.js";
import {
  QuizModelFailure,
  type ModelEvidence,
  type ModelQuizCandidate,
  type ModelQuizReview,
  type QuizModelPort
} from "../src/quiz/types.js";

const NOW = Date.UTC(2026, 6, 17, 12);
const CONFIGURATION: QuizConfiguration = {
  category: "science",
  contentMode: "general_knowledge",
  currentEventsLookbackDays: 14,
  difficultyProfile: "balanced"
};

function evidence(): ModelEvidence {
  return {
    brief: "A server-owned evidence brief containing stable science facts.",
    retrievedAt: NOW,
    sources: [{ title: "NASA reference", url: "https://www.nasa.gov/reference/science" }],
    usage: { inputTokens: 100, outputTokens: 40, searchCalls: 1 }
  };
}

function candidate(): ModelQuizCandidate {
  return {
    questions: Array.from({ length: 10 }, (_, index) => {
      const answer = `Verified answer ${index + 1}`;
      return {
        answerIndex: 0,
        category: "science" as const,
        difficulty: index >= 7 ? "difficult" as const : index >= 4 ? "intermediate" as const : "basic" as const,
        explanation: `The correct answer is "${answer}". NASA supports this stable fact.`,
        kind: "evergreen" as const,
        options: [answer, `Distractor B ${index + 1}`, `Distractor C ${index + 1}`, `Distractor D ${index + 1}`],
        prompt: `Which verified science fact is represented by item ${index + 1}?`,
        sources: [{ publisher: "nasa.gov", retrievedAt: NOW, title: "NASA reference", url: `https://www.nasa.gov/reference/science-${index + 1}` }]
      };
    }),
    title: "Verified science"
  };
}

function approvedReview(): ModelQuizReview {
  return {
    approved: true,
    questions: Array.from({ length: 10 }, (_, index) => ({
      classroomSafe: true,
      difficultyAppropriate: true,
      explanationConsistent: true,
      factuallySupported: true,
      issues: [],
      order: index + 1,
      stableForRoom: true,
      unambiguous: true
    }))
  };
}

function generatedCandidate() {
  return { usage: { inputTokens: 200, outputTokens: 100, searchCalls: 0 }, value: candidate() };
}

function reviewedCandidate() {
  return { usage: { inputTokens: 80, outputTokens: 40 }, value: approvedReview() };
}

function preparation(model: QuizModelPort, options: { readonly dailySearchLimit?: number; readonly deadlineMs?: number; readonly now?: () => number } = {}) {
  let id = 0;
  return createQuizPreparation({
    governor: createGenerationGovernor({ dailyGenerationLimit: 20, dailySearchLimit: options.dailySearchLimit ?? 20, maxConcurrent: 4 }),
    id: () => `template-${++id}`,
    model,
    now: options.now ?? (() => NOW),
    policy: {
      deadlineMs: options.deadlineMs ?? 10_000,
      developingStoryCutoffMs: 3_600_000,
      evidenceCacheMaxEntries: 8,
      evidenceCacheTtlMs: 60_000,
      retryLimit: 1
    }
  });
}

function request(roomId: RoomId = "room-one" as RoomId) {
  return { configuration: CONFIGURATION, preparationId: `prepare-${roomId}`, roomId, roundId: 1 };
}

describe("Quiz Preparation", () => {
  it("retries a transient candidate failure without repeating evidence discovery", async () => {
    const discover = vi.fn<QuizModelPort["discover"]>().mockResolvedValue(evidence());
    const generate = vi.fn<QuizModelPort["generate"]>()
      .mockRejectedValueOnce(new QuizModelFailure("rate_limited", true))
      .mockResolvedValue(generatedCandidate());
    const review = vi.fn<QuizModelPort["review"]>().mockResolvedValue(reviewedCandidate());
    const model: QuizModelPort = {
      discover,
      generate,
      review
    };

    const result = await preparation(model).prepare(request(), new AbortController().signal);

    expect(result.source).toBe("generated");
    expect(result.provenance.usage).toEqual({ inputTokens: 380, outputTokens: 180, searchCalls: 1 });
    expect(discover).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(review).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Verified science" }),
      expect.objectContaining({ brief: "A server-owned evidence brief containing stable science facts." }),
      expect.objectContaining({ roomId: "room-one" }),
      expect.any(AbortSignal)
    );
  });

  it("reuses fresh evidence while producing a distinct Quiz Template for each preparation", async () => {
    const discover = vi.fn<QuizModelPort["discover"]>().mockResolvedValue(evidence());
    const generate = vi.fn<QuizModelPort["generate"]>().mockResolvedValue(generatedCandidate());
    const model: QuizModelPort = {
      discover,
      generate,
      review: vi.fn<QuizModelPort["review"]>().mockResolvedValue(reviewedCandidate())
    };
    const quizPreparation = preparation(model);

    const first = await quizPreparation.prepare(request("room-one" as RoomId), new AbortController().signal);
    const second = await quizPreparation.prepare(request("room-two" as RoomId), new AbortController().signal);

    expect(discover).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(first.template.id).not.toBe(second.template.id);
    expect(first.provenance.usage.searchCalls).toBe(1);
    expect(second.provenance.usage.searchCalls).toBe(0);
  });

  it("continues using cached evidence after fresh-search budget is exhausted", async () => {
    const discover = vi.fn<QuizModelPort["discover"]>().mockResolvedValue(evidence());
    const model: QuizModelPort = {
      discover,
      generate: vi.fn<QuizModelPort["generate"]>().mockResolvedValue(generatedCandidate()),
      review: vi.fn<QuizModelPort["review"]>().mockResolvedValue(reviewedCandidate())
    };
    const quizPreparation = preparation(model, { dailySearchLimit: 1 });

    const first = await quizPreparation.prepare(request("room-one" as RoomId), new AbortController().signal);
    const second = await quizPreparation.prepare(request("room-two" as RoomId), new AbortController().signal);

    expect(first.source).toBe("generated");
    expect(second.source).toBe("generated");
    expect(discover).toHaveBeenCalledOnce();
  });

  it("coalesces concurrent evidence lookup without sharing generated templates", async () => {
    let resolveEvidence!: (value: ModelEvidence) => void;
    const pendingEvidence = new Promise<ModelEvidence>((resolve) => { resolveEvidence = resolve; });
    const discover = vi.fn<QuizModelPort["discover"]>().mockReturnValue(pendingEvidence);
    const generate = vi.fn<QuizModelPort["generate"]>().mockResolvedValue(generatedCandidate());
    const model: QuizModelPort = {
      discover,
      generate,
      review: vi.fn<QuizModelPort["review"]>().mockResolvedValue(reviewedCandidate())
    };
    const quizPreparation = preparation(model);

    const firstPending = quizPreparation.prepare(request("room-one" as RoomId), new AbortController().signal);
    const secondPending = quizPreparation.prepare(request("room-two" as RoomId), new AbortController().signal);
    await Promise.resolve();

    expect(discover).toHaveBeenCalledOnce();
    resolveEvidence(evidence());
    const [first, second] = await Promise.all([firstPending, secondPending]);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(first.template.id).not.toBe(second.template.id);
    expect(first.provenance.usage.searchCalls + second.provenance.usage.searchCalls).toBe(1);
  });

  it("retains conservative search usage when fresh evidence discovery fails", async () => {
    const model: QuizModelPort = {
      discover: vi.fn<QuizModelPort["discover"]>().mockRejectedValue(new QuizModelFailure("authentication", false)),
      generate: vi.fn<QuizModelPort["generate"]>(),
      review: vi.fn<QuizModelPort["review"]>()
    };

    const result = await preparation(model).prepare(request(), new AbortController().signal);

    expect(result).toMatchObject({
      provenance: { fallbackReason: "authentication", usage: { inputTokens: 0, outputTokens: 0, searchCalls: 1 } },
      source: "fallback"
    });
  });

  it("retains evidence usage when a later provider stage fails", async () => {
    const model: QuizModelPort = {
      discover: vi.fn<QuizModelPort["discover"]>().mockResolvedValue(evidence()),
      generate: vi.fn<QuizModelPort["generate"]>().mockRejectedValue(new QuizModelFailure("invalid_request", false)),
      review: vi.fn<QuizModelPort["review"]>()
    };

    const result = await preparation(model).prepare(request(), new AbortController().signal);

    expect(result).toMatchObject({
      provenance: { fallbackReason: "invalid_request", usage: { inputTokens: 100, outputTokens: 40, searchCalls: 1 } },
      source: "fallback"
    });
  });

  it("expires evidence at the next freshness bucket", async () => {
    let now = NOW;
    const discover = vi.fn<QuizModelPort["discover"]>().mockImplementation(async () => ({ ...evidence(), retrievedAt: now }));
    const model: QuizModelPort = {
      discover,
      generate: vi.fn<QuizModelPort["generate"]>().mockResolvedValue(generatedCandidate()),
      review: vi.fn<QuizModelPort["review"]>().mockResolvedValue(reviewedCandidate())
    };
    const quizPreparation = preparation(model, { now: () => now });

    await quizPreparation.prepare(request("room-one" as RoomId), new AbortController().signal);
    now += 60_000;
    await quizPreparation.prepare(request("room-two" as RoomId), new AbortController().signal);

    expect(discover).toHaveBeenCalledTimes(2);
  });

  it("lets one coalesced caller cancel without aborting another caller", async () => {
    let resolveEvidence!: (value: ModelEvidence) => void;
    const pendingEvidence = new Promise<ModelEvidence>((resolve) => { resolveEvidence = resolve; });
    const model: QuizModelPort = {
      discover: vi.fn<QuizModelPort["discover"]>().mockReturnValue(pendingEvidence),
      generate: vi.fn<QuizModelPort["generate"]>().mockResolvedValue(generatedCandidate()),
      review: vi.fn<QuizModelPort["review"]>().mockResolvedValue(reviewedCandidate())
    };
    const quizPreparation = preparation(model);
    const firstController = new AbortController();
    const firstPending = quizPreparation.prepare(request("room-one" as RoomId), firstController.signal).catch((error: unknown) => error);
    const secondPending = quizPreparation.prepare(request("room-two" as RoomId), new AbortController().signal);
    await Promise.resolve();

    firstController.abort();
    resolveEvidence(evidence());
    const [first, second] = await Promise.all([firstPending, secondPending]);

    expect(first).toBeInstanceOf(Error);
    expect(second.source).toBe("generated");
    expect(second.provenance.usage.searchCalls).toBe(1);
  });

  it("starts a fresh evidence lookup after every subscriber cancels", async () => {
    const discover = vi.fn<QuizModelPort["discover"]>()
      .mockImplementationOnce(() => new Promise<ModelEvidence>(() => undefined))
      .mockResolvedValueOnce(evidence());
    const model: QuizModelPort = {
      discover,
      generate: vi.fn<QuizModelPort["generate"]>().mockResolvedValue(generatedCandidate()),
      review: vi.fn<QuizModelPort["review"]>().mockResolvedValue(reviewedCandidate())
    };
    const quizPreparation = preparation(model, { deadlineMs: 25 });
    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstPending = quizPreparation.prepare(request("room-one" as RoomId), firstController.signal).catch((error: unknown) => error);
    const secondPending = quizPreparation.prepare(request("room-two" as RoomId), secondController.signal).catch((error: unknown) => error);
    await Promise.resolve();

    firstController.abort();
    secondController.abort();
    await Promise.all([firstPending, secondPending]);
    const third = await quizPreparation.prepare(request("room-three" as RoomId), new AbortController().signal);

    expect(third.source).toBe("generated");
    expect(discover).toHaveBeenCalledTimes(2);
  });
});
