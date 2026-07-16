export const PROTOCOL_VERSION = 1 as const;

export const CHARACTER_IDS = ["default", "knight", "ninja", "wizard"] as const;
export const CHARACTER_COLOR_IDS = ["gold", "coral", "aqua", "violet"] as const;

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
  QUESTION_COUNT: 10,
  REVEAL_MS: 5_000,
  TEMPLATE_ID: "programming-fundamentals-v1"
} as const;

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
