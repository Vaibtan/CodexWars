import { describe, expect, it } from "vitest";
import { findNearestAimTarget, normalizeAimDirection } from "../src/index.js";

describe("2D battle targeting", () => {
  it("normalizes horizontal aim and rejects a near-zero direction", () => {
    expect(normalizeAimDirection(3, 4)).toEqual({ x: 0.6, z: 0.8 });
    expect(normalizeAimDirection(0.01, 0.01)).toBeNull();
  });

  it("chooses the nearest intersected opponent and ignores players behind the attacker", () => {
    const hit = findNearestAimTarget({ x: 0, z: 0 }, 1, 0, [
      { id: "behind", position: { x: -1, z: 0 } },
      { id: "far", position: { x: 6, z: 0.1 } },
      { id: "near", position: { x: 2, z: 0.3 } },
    ], "bolt");
    expect(hit).toEqual({ distanceAlongRayM: 2, targetId: "near" });
  });

  it("does not hit a player outside the combined player and weapon ray radius", () => {
    expect(findNearestAimTarget({ x: 0, z: 0 }, 1, 0, [
      { id: "wide", position: { x: 2, z: 0.81 } },
    ], "bolt")).toBeNull();
  });
});
