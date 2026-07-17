import { describe, expect, it } from "vitest";
import { QUIZ_EVALUATION_THRESHOLDS, QUIZ_EVALUATION_V1 } from "../src/quiz/evaluation.js";

describe("quiz evaluation gate", () => {
  it("covers every approved mode, category, and difficulty profile", () => {
    expect(QUIZ_EVALUATION_V1).toHaveLength(54);
    expect(new Set(QUIZ_EVALUATION_V1.map((entry) => entry.id)).size).toBe(54);
    expect(QUIZ_EVALUATION_THRESHOLDS).toMatchObject({ factualCorrectnessMin: 0.98, unsafeContentRateMax: 0 });
  });
});
