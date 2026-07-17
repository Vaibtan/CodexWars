import { describe, expect, it } from "vitest";
import { estimateServerNow, type ServerClockAnchor } from "./serverClock";

describe("estimateServerNow", () => {
  it("advances from the observed server snapshot with the local monotonic clock", () => {
    const anchor: ServerClockAnchor = {
      observedLocalNow: 10_000,
      serverNow: 50_000,
    };

    expect(estimateServerNow(anchor, 11_250)).toBe(51_250);
  });

  it("does not move behind a newly observed server snapshot", () => {
    const anchor: ServerClockAnchor = {
      observedLocalNow: 10_000,
      serverNow: 50_000,
    };

    expect(estimateServerNow(anchor, 9_500)).toBe(50_000);
  });
});
