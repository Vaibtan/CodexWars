export const PROTOCOL_VERSION = 2 as const;

export const CHARACTER_IDS = ["default", "knight", "ninja", "wizard"] as const;
export const CHARACTER_COLOR_IDS = ["gold", "coral", "aqua", "violet"] as const;

export const ERROR_CODES = [
  "ANSWER_DUPLICATE",
  "ANSWER_LATE",
  "ANSWER_OPTION_INVALID",
  "ARENA_RADIUS_INVALID",
  "ATTACK_COOLDOWN",
  "ATTACK_DIRECTION_INVALID",
  "ATTACK_NOT_ALLOWED",
  "BATTLE_START_BLOCKED",
  "CLIENT_VERSION_UNSUPPORTED",
  "COMMAND_DUPLICATE",
  "NICKNAME_INVALID",
  "NOT_LOCALIZED",
  "PHASE_MISMATCH",
  "POSITION_IN_MARKER_EXCLUSION",
  "POSITION_INVALID",
  "POSITION_OUT_OF_BOUNDS",
  "QUESTION_MISMATCH",
  "QUIZ_APPROVAL_REQUIRED",
  "QUIZ_CONFIG_INVALID",
  "QUIZ_GENERATION_IN_PROGRESS",
  "QUIZ_GENERATION_LIMIT_REACHED",
  "QUIZ_NOT_READY",
  "RATE_LIMITED",
  "ROLE_FORBIDDEN",
  "ROOM_FULL",
  "ROOM_ID_EXHAUSTED",
  "ROOM_NOT_FOUND",
  "ROOM_NOT_JOINABLE",
  "ROUND_MISMATCH",
  "SESSION_EXPIRED",
  "SPACING_VIOLATION",
  "WEAPON_INVALID"
] as const;

export const ARENA = {
  DEFAULT_RADIUS_M: 4,
  MARKER_EXCLUSION_RADIUS_M: 0.75,
  MAX_PARTICIPANTS: 12,
  MAX_RADIUS_M: 6,
  MIN_RADIUS_M: 3,
  MIN_SPACING_M: 1.5
} as const;

export const BATTLE = {
  COUNTDOWN_MS: 5_000,
  DISCONNECT_ELIMINATION_MS: 20_000,
  DURATION_MS: 60_000,
  HOST_RECONNECT_GRACE_MS: 60_000,
  IDLE_EXPIRY_MS: 7_200_000,
  START_HP: 100
} as const;

export const QUIZ = {
  BASIC_QUESTION_MS: 30_000,
  DIFFICULT_QUESTION_MS: 45_000,
  EXPLANATION_MAX_LENGTH: 400,
  FALLBACK_TEMPLATE_ID: "fallback:general-knowledge-v1",
  OPTION_LABEL_MAX_LENGTH: 120,
  PROMPT_MAX_LENGTH: 240,
  QUESTION_COUNT: 10,
  REVEAL_MS: 5_000,
  TEMPLATE_ID_MAX_LENGTH: 80
} as const;

export const QUIZ_CONTENT_MODES = ["general_knowledge", "current_events", "mixed"] as const;
export const QUIZ_CATEGORIES = ["mixed", "science", "history", "geography", "culture", "sports"] as const;
export const QUIZ_DIFFICULTY_PROFILES = ["accessible", "balanced", "challenging"] as const;
export const CURRENT_EVENTS_LOOKBACK_DAYS = [7, 14, 30] as const;

export const WEAPONS = {
  bolt: {
    charges: -1,
    cooldownMs: 1_000,
    damage: 10,
    rangeM: 8,
    rayRadiusM: 0.35
  }
} as const;

export const PLAYER_HIT_RADIUS_M = 0.45;
export const MAX_COMMAND_BYTES = 2_048;
export const MAX_COMMANDS_PER_ROUND = 512;
export const MAX_MALFORMED_QUIZ_ATTEMPTS = 5;
export const POSITION_COMMANDS_PER_SECOND = 5;
export const ATTACK_COMMANDS_PER_SECOND = 10;
