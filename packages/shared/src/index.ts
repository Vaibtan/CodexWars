export * from "./battle/index.js";
export * from "./realtime/index.js";

export type CharacterId = "knight" | "ninja" | "wizard";

export type CharacterColorId = "gold" | "coral" | "aqua" | "violet";

export interface CharacterSelection {
  characterId: CharacterId;
  colorId: CharacterColorId;
}

export type RoomPhase =
  | "lobby"
  | "quiz"
  | "quiz-results"
  | "arena-setup"
  | "positioning"
  | "countdown"
  | "battle"
  | "results";

export interface ArenaPosition {
  x: number;
  z: number;
}

export type ParticipantReadiness = "customizing" | "positioning" | "waiting";

export interface WaitingParticipant {
  id: string;
  nickname: string;
  position: ArenaPosition;
  selection: CharacterSelection;
  status: "waiting";
}

export interface LockParticipantPositionCommand {
  type: "lock_position";
  requestId: string;
  x: number;
  z: number;
}

export interface StartBattleCommand {
  type: "start_battle";
  requestId: string;
}

export interface SelectCharacterCommand {
  type: "select_character";
  requestId: string;
  characterId: CharacterId;
  colorId: CharacterColorId;
}

export interface ReadyChangedCommand {
  type: "ready_changed";
  requestId: string;
  ready: boolean;
}

export interface QuizResult {
  displayName: string;
  rank: number;
  score: number;
  shieldReward: number;
}
