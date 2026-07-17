import type { LocalizationState } from "@codexwars/shared";
import type { ArMarkerTrackingState, ArTrackingState } from "./types";

export type MarkerTrackingPhase = "battle" | "organizer" | "positioning";

export interface MarkerTrackingDecision {
  readonly canLock: boolean;
  readonly label: string;
  readonly localization: Extract<LocalizationState, "localized" | "lost" | "searching">;
  readonly markerFound: boolean;
}

const POSITIONING_DEVICE_LABELS: Record<ArTrackingState, string> = {
  initializing: "Starting camera…",
  limited: "Move slowly and keep the floor visible",
  normal: "Floor tracking stable",
  unavailable: "Tracking unavailable",
};

const ORGANIZER_DEVICE_LABELS: Record<ArTrackingState, string> = {
  initializing: "Starting camera…",
  limited: "Move slowly and keep the printed marker visible",
  normal: "Tracking stable",
  unavailable: "Tracking unavailable",
};

export function markerTrackingDecision(
  phase: MarkerTrackingPhase,
  marker: ArMarkerTrackingState,
  tracking: ArTrackingState,
): MarkerTrackingDecision {
  const markerFound = marker === "tracked" || marker === "degraded";
  const localization = markerFound
    ? "localized"
    : marker === "lost" || phase === "battle"
      ? "lost"
      : "searching";
  const label = marker === "tracked"
    ? "Arena marker locked"
    : marker === "degraded"
      ? phase === "battle" ? "Using fresh inertial marker pose" : "Marker pose retained"
      : marker === "lost"
        ? phase === "battle" ? "Marker lost · re-scan" : "Marker lost · scan again"
        : phase === "battle"
          ? tracking === "limited" ? "Move slowly · tracking limited" : "Find the arena marker"
          : phase === "organizer"
            ? ORGANIZER_DEVICE_LABELS[tracking]
            : POSITIONING_DEVICE_LABELS[tracking];

  return {
    canLock: phase === "positioning" && marker === "tracked" && tracking === "normal",
    label,
    localization,
    markerFound,
  };
}
