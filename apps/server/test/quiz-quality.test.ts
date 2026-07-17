import { describe, expect, it } from "vitest";
import type { QuizConfiguration } from "@codexwars/shared";
import { generatedQuestionKind, materializeGeneratedAnswer, selectPlayableCandidate, validateGeneratedCandidate } from "../src/quiz/quality.js";
import type { ModelEvidenceSource, ModelQuizCandidate, ModelQuizReview } from "../src/quiz/types.js";

const NOW = Date.UTC(2026, 6, 16, 12);
const CONFIG: QuizConfiguration = {
  category: "science",
  contentMode: "general_knowledge",
  currentEventsLookbackDays: 14,
  difficultyProfile: "balanced"
};

function source(url: string, publisher: string): ModelEvidenceSource {
  return {
    publishedAt: new Date(NOW - 3 * 86_400_000).toISOString(),
    publisher,
    retrievedAt: NOW,
    title: `${publisher} reference`,
    url
  };
}

function candidate(configuration: QuizConfiguration = CONFIG): ModelQuizCandidate {
  const currentEventCount = configuration.contentMode === "current_events" ? 10 : configuration.contentMode === "mixed" ? 5 : 0;
  return {
    title: "Science around the world",
    questions: Array.from({ length: 10 }, (_, index) => {
      const currentEvent = index < currentEventCount;
      return {
        answerIndex: 1,
        category: configuration.category === "mixed" ? "science" : configuration.category,
        difficulty: index >= 7 ? "difficult" : index >= 4 ? "intermediate" : "basic",
        explanation: `The independently verified answer for science question ${index + 1} is option B.`,
        kind: currentEvent ? "current_event" : "evergreen",
        options: [`Distractor A ${index}`, `Verified answer B ${index}`, `Distractor C ${index}`, `Distractor D ${index}`],
        prompt: `Which verified science fact belongs in question number ${index + 1}?`,
        sources: currentEvent
          ? [source(`https://www.reuters.com/world/item-${index}`, "Reuters"), source(`https://apnews.com/article/item-${index}`, "Associated Press")]
          : [source(`https://www.nasa.gov/reference/item-${index}`, "NASA")]
      };
    })
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

describe("generated quiz quality policy", () => {
  it("assigns question kinds deterministically from the configured content mode", () => {
    expect(Array.from({ length: 10 }, (_, index) => generatedQuestionKind("general_knowledge", index))).toEqual(Array(10).fill("evergreen"));
    expect(Array.from({ length: 10 }, (_, index) => generatedQuestionKind("current_events", index))).toEqual(Array(10).fill("current_event"));
    expect(Array.from({ length: 10 }, (_, index) => generatedQuestionKind("mixed", index))).toEqual([
      "current_event", "current_event", "current_event", "current_event", "current_event",
      "evergreen", "evergreen", "evergreen", "evergreen", "evergreen"
    ]);
  });

  it("places the generated correct answer and computes its authoritative index", () => {
    expect(materializeGeneratedAnswer("Mercury", ["Venus", "Earth", "Mars"], 1)).toEqual({
      answerIndex: 1,
      options: ["Venus", "Mercury", "Earth", "Mars"]
    });
  });

  it("selects ten independently approved questions from a buffered candidate", () => {
    const value = candidate();
    const buffered: ModelQuizCandidate = {
      ...value,
      questions: [
        ...value.questions,
        { ...value.questions[8]!, prompt: "Which verified science fact belongs in buffered question 11?" },
        { ...value.questions[0]!, prompt: "Which verified science fact belongs in buffered question 12?" }
      ]
    };
    const baseReview = approvedReview();
    const review: ModelQuizReview = {
      approved: false,
      questions: [
        ...baseReview.questions.slice(0, 5),
        { ...baseReview.questions[5]!, issues: ["implausible_options"] },
        ...baseReview.questions.slice(6),
        { ...baseReview.questions[8]!, order: 11 },
        { ...baseReview.questions[9]!, order: 12 }
      ]
    };

    const selected = selectPlayableCandidate(buffered, review, CONFIG);

    expect(selected?.candidate.questions).toHaveLength(10);
    expect(selected?.candidate.questions.map((question) => question.prompt)).not.toContain(value.questions[5]!.prompt);
    expect(selected?.candidate.questions.slice(0, 7).every((question) => question.difficulty !== "difficult")).toBe(true);
    expect(selected?.candidate.questions.slice(7).every((question) => question.difficulty === "difficult")).toBe(true);
    expect(selected?.review.approved).toBe(true);
    expect(selected?.review.questions.map((question) => question.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("converts an approved candidate into a playable immutable-domain template", () => {
    const validation = validateGeneratedCandidate(candidate(), approvedReview(), CONFIG, NOW, 86_400_000, "generated:01JZ8V7Y8TQ5B7MT3Y94K6Y8V2");

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.template.questions).toHaveLength(10);
    expect(validation.template.questions[0]).toMatchObject({ answerOptionId: "b", id: "q-01", order: 1 });
  });

  it("rejects a current-event question without two independent date-bounded sources", () => {
    const configuration = { ...CONFIG, contentMode: "current_events" } as const;
    const value = candidate(configuration);
    const invalid = {
      ...value,
      questions: [{ ...value.questions[0]!, sources: [source("https://www.reuters.com/world/only-one", "Reuters")] }, ...value.questions.slice(1)]
    };

    expect(validateGeneratedCandidate(invalid, approvedReview(), configuration, NOW, 86_400_000, "generated:01JZ8V7Y8TQ5B7MT3Y94K6Y8V2")).toEqual({ ok: false });
  });

  it("rejects evidence outside the server-approved source policy", () => {
    const value = candidate();
    const invalid = {
      ...value,
      questions: [{ ...value.questions[0]!, sources: [source("https://unknown.example/fact", "Unknown")] }, ...value.questions.slice(1)]
    };

    expect(validateGeneratedCandidate(invalid, approvedReview(), CONFIG, NOW, 86_400_000, "generated:01JZ8V7Y8TQ5B7MT3Y94K6Y8V2")).toEqual({ ok: false });
  });
});
