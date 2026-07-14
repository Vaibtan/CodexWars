export type CharacterId = "knight" | "ninja" | "wizard";

export type CharacterColorId = "gold" | "coral" | "aqua" | "violet";

export interface CharacterSelection {
  characterId: CharacterId;
  colorId: CharacterColorId;
}

export type RoomPhase = "lobby" | "quiz" | "localization" | "positioning" | "battle" | "results";

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
  type: "lock_participant_position";
  position: ArenaPosition;
  selection: CharacterSelection;
}

export interface StartBattleCommand {
  type: "start_battle";
}
