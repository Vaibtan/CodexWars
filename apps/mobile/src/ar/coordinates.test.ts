import { describe, expect, it } from "vitest";
import { captureMarkerSpacePose, freshAimDirection } from "./coordinates";

describe("marker-space pose capture", () => {
  it("publishes camera position and aim relative to a translated marker", () => {
    const pose = captureMarkerSpacePose(
      { position: [10, 0, -4], rotation: [0, 0, 0] },
      { forward: [0, 0, -1], position: [12, 1.6, -1] },
      1_000,
    );

    expect(pose).toEqual({
      capturedAt: 1_000,
      direction: { x: 0, z: -1 },
      position: { x: 2, y: 1.6, z: 3 },
    });
  });

  it("removes the marker rotation from both position and camera-forward direction", () => {
    const pose = captureMarkerSpacePose(
      { position: [5, 0, 5], rotation: [0, 90, 0] },
      { forward: [-1, 0, 0], position: [8, 1.5, 5] },
      2_000,
    );

    expect(pose.position.x).toBeCloseTo(0, 10);
    expect(pose.position.y).toBeCloseTo(1.5, 10);
    expect(pose.position.z).toBeCloseTo(3, 10);
    expect(pose.direction?.x).toBeCloseTo(0, 10);
    expect(pose.direction?.z).toBeCloseTo(-1, 10);
  });

  it("refuses vertical or stale camera aim", () => {
    const vertical = captureMarkerSpacePose(
      { position: [0, 0, 0], rotation: [0, 0, 0] },
      { forward: [0.03, -0.99, 0.04], position: [2, 1.6, 2] },
      5_000,
    );
    const usable = captureMarkerSpacePose(
      { position: [0, 0, 0], rotation: [0, 0, 0] },
      { forward: [0.6, -0.2, -0.8], position: [2, 1.6, 2] },
      5_000,
    );

    expect(freshAimDirection(vertical, 5_100)).toBeNull();
    expect(freshAimDirection(usable, 6_001)).toBeNull();
    expect(freshAimDirection(usable, 6_000)).toEqual({ x: 0.6, z: -0.8 });
  });
});
