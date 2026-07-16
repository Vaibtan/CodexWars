import type { PROTOCOL_VERSION, QUIZ } from "./constants.js";

export type ProtocolVersion = typeof PROTOCOL_VERSION;
export type RoomId = string;
export type PlayerId = string;
export type RoundId = number;
export type CommandId = string;
export type EventSequence = number;
export type CharacterId = "default" | "knight" | "ninja" | "wizard";
export type CharacterColorId = "gold" | "coral" | "aqua" | "violet";
export type WeaponId = "bolt" | "fireball";

export type RoomPhase =
  | "lobby"
  | "quiz"
  | "quiz-results"
  | "arena-setup"
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

export type ErrorCode =
  | "ANSWER_DUPLICATE"
  | "ANSWER_LATE"
  | "ANSWER_OPTION_INVALID"
  | "ARENA_RADIUS_INVALID"
  | "ATTACK_COOLDOWN"
  | "ATTACK_DIRECTION_INVALID"
  | "ATTACK_NOT_ALLOWED"
  | "BATTLE_START_BLOCKED"
  | "CLIENT_VERSION_UNSUPPORTED"
  | "COMMAND_DUPLICATE"
  | "NICKNAME_INVALID"
  | "NOT_LOCALIZED"
  | "PHASE_MISMATCH"
  | "POSITION_IN_MARKER_EXCLUSION"
  | "POSITION_INVALID"
  | "POSITION_OUT_OF_BOUNDS"
  | "QUESTION_MISMATCH"
  | "QUIZ_NOT_READY"
  | "RATE_LIMITED"
  | "ROLE_FORBIDDEN"
  | "ROOM_FULL"
  | "ROOM_ID_EXHAUSTED"
  | "ROOM_NOT_FOUND"
  | "ROOM_NOT_JOINABLE"
  | "ROUND_MISMATCH"
  | "SESSION_EXPIRED"
  | "SPACING_VIOLATION"
  | "WEAPON_INVALID";
