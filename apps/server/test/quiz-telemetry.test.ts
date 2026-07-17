import { describe, expect, it } from "vitest";
import { createQuizTelemetry } from "../src/quiz/telemetry.js";

describe("quiz telemetry", () => {
  it("aggregates bounded operational outcomes without retaining quiz content", () => {
    const telemetry = createQuizTelemetry();
    telemetry.record({ durationMs: 120, inputTokens: 200, outcome: "generated", outputTokens: 100, searchCalls: 2 });
    telemetry.record({ durationMs: 30, inputTokens: 0, outcome: "budget_exhausted", outputTokens: 0, searchCalls: 0 });

    expect(telemetry.snapshot()).toEqual({
      attempts: 2,
      durationMs: { count: 2, max: 120, sum: 150 },
      estimatedTextCostUsd: 0.0006,
      inputTokens: 200,
      outcomes: { budget_exhausted: 1, generated: 1 },
      outputTokens: 100,
      searchCalls: 2
    });
  });
});
