import { describe, expect, it } from "vitest";
import { PROGRAMMING_FUNDAMENTALS_V1 } from "../src/quiz/programmingFundamentalsV1.js";

describe("PROGRAMMING_FUNDAMENTALS_V1", () => {
  it("preserves the locked ten-question timing template", () => {
    const questions = PROGRAMMING_FUNDAMENTALS_V1.questions;

    expect(questions).toHaveLength(10);
    expect(questions.filter((question) => question.durationMs === 30_000)).toHaveLength(7);
    expect(questions.filter((question) => question.durationMs === 45_000)).toHaveLength(3);
    expect(questions.every((question) => question.options.some((option) => option.id === question.correctOptionId))).toBe(true);
  });
});
