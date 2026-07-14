export type CharacterId = "default";

export type RoomPhase =
  | "lobby"
  | "quiz"
  | "localization"
  | "positioning"
  | "countdown"
  | "battle"
  | "results";

export interface ArenaPosition {
  x: number;
  z: number;
}
