import type { CHARACTER_COLOR_IDS, CHARACTER_IDS, ERROR_CODES, PROTOCOL_VERSION, QUIZ } from "./constants.js";

export type ProtocolVersion = typeof PROTOCOL_VERSION;
export type RoomId = string;
export type PlayerId = string;
export type RoundId = number;
export type CommandId = string;
export type EventSequence = number;
export type CharacterId = typeof CHARACTER_IDS[number];
export type CharacterColorId = typeof CHARACTER_COLOR_IDS[number];
export type WeaponId = "bolt";

export type RoomPhase =
  | "lobby"
  | "quiz"
  | "localization"
  | "positioning"
  | "countdown"
  | "battle"
  | "results";

export type LocalizationState = "not_started" | "searching" | "localized" | "lost";
export type QuizStatus = "unconfigured" | "ready" | "question" | "reveal" | "completed";
export type QuizDifficulty = "basic" | "intermediate" | "difficult";
export type BattleStatus = "not_started" | "countdown" | "active" | "completed";

export interface ArenaPosition {
  readonly x: number;
  readonly z: number;
}

export interface CharacterSelection {
  readonly characterId: CharacterId;
  readonly colorId: CharacterColorId;
}

export interface QuizOption {
  readonly id: string;
  readonly label: string;
}

export interface QuizQuestion {
  readonly answerOptionId: string;
  readonly difficulty: QuizDifficulty;
  readonly durationMs: number;
  readonly explanation: string;
  readonly id: string;
  readonly options: readonly QuizOption[];
  readonly order: number;
  readonly prompt: string;
}

export interface PublicQuizQuestion {
  readonly difficulty: QuizDifficulty;
  readonly durationMs: number;
  readonly id: string;
  readonly options: readonly QuizOption[];
  readonly order: number;
  readonly prompt: string;
}

export interface QuizTemplate {
  readonly id: typeof QUIZ.TEMPLATE_ID;
  readonly questions: readonly QuizQuestion[];
}

export interface Standing {
  readonly correctAnswers: number;
  readonly displayName: string;
  readonly eliminated: boolean;
  readonly hp: number;
  readonly playerId: PlayerId;
  readonly rank: number;
  readonly shield: number;
}

export type ErrorCode = typeof ERROR_CODES[number];
