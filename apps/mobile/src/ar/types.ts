export type ArFlowPhase = "floor-scan" | "battle";

export type ArTrackingState = "initializing" | "limited" | "normal" | "unavailable";

export type AttackId = "bolt" | "fireball" | "shield";

export type ArSceneBridge = {
  onFloorFound: () => void;
  onTrackingChanged: (state: ArTrackingState) => void;
};
