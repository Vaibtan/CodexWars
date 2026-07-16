import { describe, expect, it } from "vitest";
import {
  PROGRAMMING_FUNDAMENTALS_V1,
  publicQuizQuestion,
  startingShieldForScore,
  validateQuizTemplate,
} from "../src/index.js";

describe("fixed P0 quiz rules", () => {
  it("validates the bundled ten-question template and projects a question without its answer", () => {
    expect(validateQuizTemplate(PROGRAMMING_FUNDAMENTALS_V1)).toEqual({ ok: true });
    expect(publicQuizQuestion(PROGRAMMING_FUNDAMENTALS_V1.questions[0])).toEqual({
      difficulty: "basic",
      durationMs: 30_000,
      id: "pf-01",
      options: [
        { id: "a", label: "3" },
        { id: "b", label: "5" },
        { id: "c", label: "6" },
        { id: "d", label: "error" },
      ],
      order: 1,
      prompt: "let x = 3; x = x + 2; What is x?",
    });
  });

  it.each([
    [0, 0], [2, 0], [3, 10], [4, 10], [5, 20],
    [6, 20], [7, 30], [8, 30], [9, 40], [10, 40],
  ])("maps %i correct answers to %i starting shield", (correctAnswers, shield) => {
    expect(startingShieldForScore(correctAnswers)).toBe(shield);
  });
});
