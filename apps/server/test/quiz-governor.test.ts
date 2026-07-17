import { describe, expect, it } from "vitest";
import { createGenerationGovernor } from "../src/quiz/governor.js";

describe("generation governor", () => {
  it("reserves search budget before provider work and retains it after release", () => {
    const governor = createGenerationGovernor({ dailyGenerationLimit: 10, dailySearchLimit: 1, maxConcurrent: 1 });
    const permit = governor.acquire(0);

    expect(permit?.reserveSearchCalls(1)).toBe(true);
    permit?.release();
    const cachedWorkPermit = governor.acquire(1);
    expect(cachedWorkPermit).toBeDefined();
    expect(cachedWorkPermit?.reserveSearchCalls(1)).toBe(false);
  });
});
