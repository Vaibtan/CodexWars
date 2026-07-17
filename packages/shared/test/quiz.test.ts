import { describe, expect, it } from "vitest";
import {
  GENERAL_KNOWLEDGE_FALLBACK_V1,
  publicQuizQuestion,
  startingShieldForScore,
  validateQuizTemplate,
} from "../src/index.js";

describe("quiz template rules", () => {
  it("validates the curated fallback and projects a question without private authority", () => {
    expect(validateQuizTemplate(GENERAL_KNOWLEDGE_FALLBACK_V1)).toEqual({ ok: true });
    expect(publicQuizQuestion(GENERAL_KNOWLEDGE_FALLBACK_V1.questions[0])).toEqual({
      difficulty: "basic",
      durationMs: 30_000,
      id: "gk-01",
      options: [
        { id: "a", label: "Pacific Ocean" },
        { id: "b", label: "Atlantic Ocean" },
        { id: "c", label: "Indian Ocean" },
        { id: "d", label: "Arctic Ocean" },
      ],
      order: 1,
      prompt: "Which is the largest ocean on Earth?",
    });
  });

  it("accepts opaque generated template IDs and rejects ambiguous option labels", () => {
    const generated = { ...GENERAL_KNOWLEDGE_FALLBACK_V1, id: "generated:01JZ8V7Y8TQ5B7MT3Y94K6Y8V2" };
    expect(validateQuizTemplate(generated)).toEqual({ ok: true });

    const first = generated.questions[0]!;
    const ambiguous = {
      ...generated,
      questions: [{ ...first, options: first.options.map((option) => ({ ...option, label: "Same answer" })) }, ...generated.questions.slice(1)],
    };
    expect(validateQuizTemplate(ambiguous)).toEqual({ ok: false, reason: "question option labels must be distinct" });

    const punctuationEquivalent = {
      ...generated,
      questions: [{ ...first, options: first.options.map((option, index) => index === 1 ? { ...option, label: `${first.options[0]!.label}!` } : option) }, ...generated.questions.slice(1)],
    };
    expect(validateQuizTemplate(punctuationEquivalent)).toEqual({ ok: false, reason: "question option labels must be distinct" });
  });

  it.each([
    [0, 0], [2, 0], [3, 10], [4, 10], [5, 20],
    [6, 20], [7, 30], [8, 30], [9, 40], [10, 40],
  ])("maps %i correct answers to %i starting shield", (correctAnswers, shield) => {
    expect(startingShieldForScore(correctAnswers)).toBe(shield);
  });
});
