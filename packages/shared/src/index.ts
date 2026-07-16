import type { ArenaPosition, CharacterColorId, CharacterId } from "./types.js";

export * from "./combat.js";
export * from "./constants.js";
export * from "./protocol.js";
export * from "./quiz.js";
export * from "./types.js";

export interface CharacterSelection {
  characterId: CharacterId;
  colorId: CharacterColorId;
}

export type ParticipantReadiness = "lobby" | "quiz-ready" | "customizing" | "positioning" | "waiting";

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
