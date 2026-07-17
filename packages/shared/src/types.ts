import type { CHARACTER_COLOR_IDS, CHARACTER_IDS, CURRENT_EVENTS_LOOKBACK_DAYS, ERROR_CODES, PROTOCOL_VERSION, QUIZ_CATEGORIES, QUIZ_CONTENT_MODES, QUIZ_DIFFICULTY_PROFILES } from "./constants.js";

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
export type QuizStatus = "unconfigured" | "configured" | "generating" | "awaiting_approval" | "ready" | "fallback_ready" | "question" | "reveal" | "completed";
export type QuizDifficulty = "basic" | "intermediate" | "difficult";
export type QuizContentMode = typeof QUIZ_CONTENT_MODES[number];
export type QuizCategory = typeof QUIZ_CATEGORIES[number];
export type QuizDifficultyProfile = typeof QUIZ_DIFFICULTY_PROFILES[number];
export type CurrentEventsLookbackDays = typeof CURRENT_EVENTS_LOOKBACK_DAYS[number];
export type QuizTemplateSource = "generated" | "fallback";
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
  readonly id: string;
  readonly questions: readonly QuizQuestion[];
}

export interface QuizConfiguration {
  readonly category: QuizCategory;
  readonly contentMode: QuizContentMode;
  readonly currentEventsLookbackDays: CurrentEventsLookbackDays;
  readonly difficultyProfile: QuizDifficultyProfile;
}

export interface QuizEvidenceSource {
  readonly publishedAt?: string;
  readonly publisher: string;
  readonly title: string;
  readonly url: string;
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
