import type { ArenaPosition, CharacterSelection } from "../features/characters/types";
import type { MarkerSpacePose } from "./coordinates";

export type ArFlowPhase = "marker-scan" | "organizer-lobby" | "battle";

export type ArTrackingState = "initializing" | "limited" | "normal" | "unavailable";

export type ArMarkerTrackingState = "degraded" | "lost" | "searching" | "tracked";

export type ArBattleActor = {
  characterSelection: CharacterSelection;
  displayName: string;
  eliminated: boolean;
  hp: number;
  maxHp: number;
  playerId: string;
  position: ArenaPosition;
};

export type ArSceneBridge = {
  arenaRadiusM?: number;
  battleActors?: readonly ArBattleActor[];
  characterSelection?: CharacterSelection;
  localPreviewPosition?: ArenaPosition;
  onMarkerTrackingChanged?: (state: ArMarkerTrackingState) => void;
  onPlacementChanged?: (position: ArenaPosition) => void;
  onPoseChanged?: (pose: MarkerSpacePose) => void;
  onTrackingChanged: (state: ArTrackingState) => void;
  phase?: "battle" | "marker-scan" | "positioning";
};
