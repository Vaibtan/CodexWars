import { describe, expect, it } from "vitest";
import { markerTrackingDecision } from "./markerTrackingPolicy";

describe("marker tracking policy", () => {
  it("permits position locking only with a tracked marker and normal device tracking", () => {
    expect(markerTrackingDecision("positioning", "tracked", "normal")).toMatchObject({ canLock: true, localization: "localized" });
    expect(markerTrackingDecision("positioning", "degraded", "normal")).toMatchObject({ canLock: false, localization: "localized" });
    expect(markerTrackingDecision("positioning", "tracked", "limited")).toMatchObject({ canLock: false, localization: "localized" });
  });

  it("maps a searching marker differently during positioning and battle", () => {
    expect(markerTrackingDecision("positioning", "searching", "normal").localization).toBe("searching");
    expect(markerTrackingDecision("battle", "searching", "normal").localization).toBe("lost");
  });

  it("retains a degraded pose with phase-specific operator copy", () => {
    expect(markerTrackingDecision("organizer", "degraded", "normal")).toMatchObject({ label: "Marker pose retained", markerFound: true });
    expect(markerTrackingDecision("battle", "degraded", "normal")).toMatchObject({ label: "Using fresh inertial marker pose", markerFound: true });
  });
});
