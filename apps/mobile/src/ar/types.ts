import type { ArenaPosition, CharacterSelection } from "../features/characters/types";

export type ArFlowPhase = "floor-scan" | "organizer-lobby" | "battle";

export type ArTrackingState = "initializing" | "limited" | "normal" | "unavailable";

export type AttackId = "bolt" | "fireball" | "shield";

export type ArSceneBridge = {
  characterSelection?: CharacterSelection;
  onFloorFound?: () => void;
  onPlacementChanged?: (position: ArenaPosition) => void;
  onTrackingChanged: (state: ArTrackingState) => void;
};
