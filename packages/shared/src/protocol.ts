import { MAX_COMMAND_BYTES, PROTOCOL_VERSION } from "./constants.js";
import type { CommandId, ErrorCode, PlayerId, RoundId, Standing } from "./types.js";

export interface CommandMeta {
  readonly commandId: CommandId;
  readonly roundId: RoundId;
}

export type CommandName =
  | "attack"
  | "configure_arena"
  | "localization_changed"
  | "lock_position"
  | "ready_changed"
  | "reset_round"
  | "select_quiz_template"
  | "set_combat_included"
  | "start_battle"
  | "start_quiz"
  | "unlock_position"
  | "quiz_answer";

export type ValidatedCommand =
  | (CommandMeta & { readonly command: "set_combat_included"; readonly included: boolean; readonly playerId: PlayerId })
  | (CommandMeta & { readonly command: "configure_arena"; readonly radiusM: number })
  | (CommandMeta & { readonly command: "select_quiz_template"; readonly templateId: "programming-fundamentals-v1" })
  | (CommandMeta & { readonly command: "start_quiz" })
  | (CommandMeta & { readonly command: "start_battle" })
  | (CommandMeta & { readonly command: "reset_round" })
  | (CommandMeta & { readonly command: "quiz_answer"; readonly optionId: string; readonly questionId: string })
  | (CommandMeta & { readonly command: "localization_changed"; readonly state: "searching" | "localized" | "lost" })
  | (CommandMeta & { readonly command: "lock_position"; readonly x: number; readonly z: number })
  | (CommandMeta & { readonly command: "unlock_position" })
  | (CommandMeta & { readonly command: "ready_changed"; readonly ready: boolean })
  | (CommandMeta & { readonly command: "attack"; readonly dirX: number; readonly dirZ: number; readonly predictedTargetId?: PlayerId; readonly weaponId: "bolt" });

export type RuntimeParseResult = { readonly ok: true; readonly value: ValidatedCommand } | { readonly code: "RATE_LIMITED" | "POSITION_INVALID"; readonly ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function hasMeta(value: Record<string, unknown>): value is Record<string, unknown> & CommandMeta {
  return typeof value.commandId === "string" && value.commandId.length > 0 && value.commandId.length <= 64 && Number.isInteger(value.roundId) && (value.roundId as number) >= 1;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function serializedCommandBytes(payload: unknown): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

export function parseCommand(name: CommandName, payload: unknown): RuntimeParseResult {
  if (!isRecord(payload) || !hasMeta(payload)) {
    return { code: "POSITION_INVALID", ok: false };
  }
  if (serializedCommandBytes(payload) > MAX_COMMAND_BYTES) return { code: "RATE_LIMITED", ok: false };
  const base = { commandId: payload.commandId, roundId: payload.roundId };
  const only = (keys: readonly string[]): boolean => hasOnlyKeys(payload, ["commandId", "roundId", ...keys]);

  switch (name) {
    case "set_combat_included":
      return only(["playerId", "included"]) && typeof payload.playerId === "string" && typeof payload.included === "boolean"
        ? { ok: true, value: { ...base, command: name, included: payload.included, playerId: payload.playerId } }
        : { code: "POSITION_INVALID", ok: false };
    case "configure_arena":
      return only(["radiusM"]) && finite(payload.radiusM)
        ? { ok: true, value: { ...base, command: name, radiusM: payload.radiusM } }
        : { code: "POSITION_INVALID", ok: false };
    case "select_quiz_template":
      return only(["templateId"]) && payload.templateId === "programming-fundamentals-v1"
        ? { ok: true, value: { ...base, command: name, templateId: payload.templateId } }
        : { code: "POSITION_INVALID", ok: false };
    case "start_quiz":
    case "start_battle":
    case "reset_round":
    case "unlock_position":
      return only([]) ? { ok: true, value: { ...base, command: name } } as RuntimeParseResult : { code: "POSITION_INVALID", ok: false };
    case "quiz_answer":
      return only(["questionId", "optionId"]) && typeof payload.questionId === "string" && typeof payload.optionId === "string"
        ? { ok: true, value: { ...base, command: name, optionId: payload.optionId, questionId: payload.questionId } }
        : { code: "POSITION_INVALID", ok: false };
    case "localization_changed":
      return only(["state"]) && (payload.state === "searching" || payload.state === "localized" || payload.state === "lost")
        ? { ok: true, value: { ...base, command: name, state: payload.state } }
        : { code: "POSITION_INVALID", ok: false };
    case "lock_position":
      return only(["x", "z"]) && finite(payload.x) && finite(payload.z)
        ? { ok: true, value: { ...base, command: name, x: payload.x, z: payload.z } }
        : { code: "POSITION_INVALID", ok: false };
    case "ready_changed":
      return only(["ready"]) && typeof payload.ready === "boolean"
        ? { ok: true, value: { ...base, command: name, ready: payload.ready } }
        : { code: "POSITION_INVALID", ok: false };
    case "attack":
      return only(["weaponId", "dirX", "dirZ", "predictedTargetId"]) && payload.weaponId === "bolt" && finite(payload.dirX) && finite(payload.dirZ) && (payload.predictedTargetId === undefined || typeof payload.predictedTargetId === "string")
        ? { ok: true, value: { ...base, command: name, dirX: payload.dirX, dirZ: payload.dirZ, ...(typeof payload.predictedTargetId === "string" ? { predictedTargetId: payload.predictedTargetId } : {}), weaponId: payload.weaponId } }
        : { code: "POSITION_INVALID", ok: false };
  }
}

export function isSupportedProtocolVersion(value: unknown): value is typeof PROTOCOL_VERSION {
  return value === PROTOCOL_VERSION;
}

export interface ServerEventPayloads {
  readonly attack_resolved: { readonly attackerId: PlayerId; readonly commandId: CommandId; readonly damage: number; readonly targetHp: number | null; readonly targetId: PlayerId | null; readonly targetShield: number | null };
  readonly battle_completed: { readonly reason: "last_alive" | "timer"; readonly standings: readonly Standing[]; readonly winnerId: PlayerId };
  readonly battle_countdown_started: { readonly endsAt: number; readonly startsAt: number };
  readonly player_eliminated: { readonly eliminatedByPlayerId: PlayerId | null; readonly playerId: PlayerId };
  readonly quiz_question_revealed: { readonly correctOptionId: string; readonly explanation: string; readonly questionId: string; readonly revealEndsAt: number };
  readonly quiz_question_started: { readonly questionEndsAt: number; readonly questionId: string; readonly questionIndex: number };
}

export type ServerEventName = keyof ServerEventPayloads;

function isStanding(value: unknown): value is Standing {
  return isRecord(value) && typeof value.playerId === "string" && typeof value.displayName === "string" && finite(value.rank) && finite(value.hp) && finite(value.shield) && finite(value.correctAnswers) && typeof value.eliminated === "boolean";
}

export function isServerEventPayload<Name extends ServerEventName>(name: Name, value: unknown): value is ServerEventPayloads[Name] {
  if (!isRecord(value)) return false;
  switch (name) {
    case "attack_resolved":
      return hasExactKeys(value, ["attackerId", "commandId", "damage", "targetHp", "targetId", "targetShield"]) && typeof value.commandId === "string" && typeof value.attackerId === "string" && finite(value.damage) && (value.targetId === null || typeof value.targetId === "string") && (value.targetShield === null || finite(value.targetShield)) && (value.targetHp === null || finite(value.targetHp));
    case "battle_completed":
      return hasExactKeys(value, ["reason", "standings", "winnerId"]) && (value.reason === "last_alive" || value.reason === "timer") && typeof value.winnerId === "string" && Array.isArray(value.standings) && value.standings.every(isStanding);
    case "battle_countdown_started":
      return hasExactKeys(value, ["endsAt", "startsAt"]) && finite(value.startsAt) && finite(value.endsAt);
    case "player_eliminated":
      return hasExactKeys(value, ["eliminatedByPlayerId", "playerId"]) && typeof value.playerId === "string" && (value.eliminatedByPlayerId === null || typeof value.eliminatedByPlayerId === "string");
    case "quiz_question_revealed":
      return hasExactKeys(value, ["correctOptionId", "explanation", "questionId", "revealEndsAt"]) && typeof value.questionId === "string" && typeof value.correctOptionId === "string" && typeof value.explanation === "string" && finite(value.revealEndsAt);
    case "quiz_question_started":
      return hasExactKeys(value, ["questionEndsAt", "questionId", "questionIndex"]) && typeof value.questionId === "string" && Number.isInteger(value.questionIndex) && finite(value.questionEndsAt);
  }
}

export interface PrivateEventPayloads {
  readonly command_accepted: { readonly command: CommandName; readonly commandId: CommandId; readonly serverNow: number };
  readonly quiz_answer_accepted: { readonly acceptedAt: number; readonly commandId: CommandId; readonly questionId: string; readonly roundId: RoundId };
  readonly quiz_answer_result: { readonly correct: boolean; readonly questionId: string; readonly roundId: RoundId; readonly runningCorrectAnswers: number; readonly selectedOptionId?: string };
  readonly quiz_completed: { readonly correctAnswers: number; readonly questionCount: number; readonly roundId: RoundId; readonly startingShield: number };
}

export type PrivateEventName = keyof PrivateEventPayloads;

export function isPrivateEventPayload<Name extends PrivateEventName>(name: Name, value: unknown): value is PrivateEventPayloads[Name] {
  if (!isRecord(value)) return false;
  switch (name) {
    case "command_accepted":
      return hasExactKeys(value, ["command", "commandId", "serverNow"]) && isOneOf(value.command, ["attack", "configure_arena", "localization_changed", "lock_position", "ready_changed", "reset_round", "select_quiz_template", "set_combat_included", "start_battle", "start_quiz", "unlock_position", "quiz_answer"]) && typeof value.commandId === "string" && finite(value.serverNow);
    case "quiz_answer_accepted":
      return hasExactKeys(value, ["acceptedAt", "commandId", "questionId", "roundId"]) && finite(value.acceptedAt) && typeof value.commandId === "string" && typeof value.questionId === "string" && isPositiveInteger(value.roundId);
    case "quiz_answer_result":
      return (hasExactKeys(value, ["correct", "questionId", "roundId", "runningCorrectAnswers"]) || hasExactKeys(value, ["correct", "questionId", "roundId", "runningCorrectAnswers", "selectedOptionId"])) && isBoolean(value.correct) && typeof value.questionId === "string" && isPositiveInteger(value.roundId) && isNonNegativeInteger(value.runningCorrectAnswers) && (value.selectedOptionId === undefined || typeof value.selectedOptionId === "string");
    case "quiz_completed":
      return hasExactKeys(value, ["correctAnswers", "questionCount", "roundId", "startingShield"]) && isNonNegativeInteger(value.correctAnswers) && isNonNegativeInteger(value.questionCount) && isPositiveInteger(value.roundId) && isNonNegativeInteger(value.startingShield);
  }
}

export interface ClientEventPayloads extends PrivateEventPayloads {
  readonly server_error: { readonly code: ErrorCode; readonly commandId?: CommandId; readonly details?: Record<string, unknown>; readonly message: string; readonly retryable: boolean; readonly roundId: RoundId };
}

export type ClientEventName = keyof ClientEventPayloads;

const ERROR_CODES: readonly ErrorCode[] = ["ANSWER_DUPLICATE", "ANSWER_LATE", "ANSWER_OPTION_INVALID", "ARENA_RADIUS_INVALID", "ATTACK_COOLDOWN", "ATTACK_DIRECTION_INVALID", "ATTACK_NOT_ALLOWED", "BATTLE_START_BLOCKED", "CLIENT_VERSION_UNSUPPORTED", "COMMAND_DUPLICATE", "NICKNAME_INVALID", "NOT_LOCALIZED", "PHASE_MISMATCH", "POSITION_IN_MARKER_EXCLUSION", "POSITION_INVALID", "POSITION_OUT_OF_BOUNDS", "QUESTION_MISMATCH", "QUIZ_NOT_READY", "RATE_LIMITED", "ROLE_FORBIDDEN", "ROOM_FULL", "ROOM_ID_EXHAUSTED", "ROOM_NOT_FOUND", "ROOM_NOT_JOINABLE", "ROUND_MISMATCH", "SESSION_EXPIRED", "SPACING_VIOLATION", "WEAPON_INVALID"];

function isSafeErrorDetails(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (hasExactKeys(value, ["blockers"])) return Array.isArray(value.blockers) && value.blockers.every((blocker) => isRecord(blocker) && hasExactKeys(blocker, ["playerId", "reason"]) && typeof blocker.playerId === "string" && typeof blocker.reason === "string");
  const keys = ["correction", "distanceM", "conflictsWithPlayerId"];
  if (!hasOnlyKeys(value, keys) || !("correction" in value) || !("distanceM" in value) || !isRecord(value.correction) || !hasExactKeys(value.correction, ["x", "z"])) return false;
  return finite(value.correction.x) && finite(value.correction.z) && finite(value.distanceM) && (value.conflictsWithPlayerId === undefined || typeof value.conflictsWithPlayerId === "string");
}

export function isClientEventPayload<Name extends ClientEventName>(name: Name, value: unknown): value is ClientEventPayloads[Name] {
  if (name !== "server_error") return isPrivateEventPayload(name, value);
  if (!isRecord(value) || !hasOnlyKeys(value, ["code", "commandId", "details", "message", "retryable", "roundId"])) return false;
  return isOneOf(value.code, ERROR_CODES)
    && typeof value.message === "string"
    && isBoolean(value.retryable)
    && isPositiveInteger(value.roundId)
    && (value.commandId === undefined || typeof value.commandId === "string")
    && (value.details === undefined || isSafeErrorDetails(value.details));
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

function isOneOf<Value extends string>(value: unknown, values: readonly Value[]): value is Value {
  return typeof value === "string" && values.includes(value as Value);
}

function isOrganizerProjection(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, ["connected", "displayName"]) && isBoolean(value.connected) && typeof value.displayName === "string";
}

function isPlayerProjection(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["characterId", "charges", "combatIncluded", "connected", "correctAnswers", "disconnectedAt", "displayName", "eliminated", "hasAnsweredCurrent", "hp", "localization", "maxHp", "nextAttackAt", "playerId", "positionLocked", "positionX", "positionZ", "quizCompleted", "ready", "shield", "weaponId"])
    && typeof value.characterId === "string"
    && value.charges === -1
    && isBoolean(value.combatIncluded)
    && isBoolean(value.connected)
    && isNonNegativeInteger(value.correctAnswers)
    && finite(value.disconnectedAt)
    && typeof value.displayName === "string"
    && isBoolean(value.eliminated)
    && isBoolean(value.hasAnsweredCurrent)
    && finite(value.hp)
    && isOneOf(value.localization, ["not_started", "searching", "localized", "lost"])
    && finite(value.maxHp)
    && finite(value.nextAttackAt)
    && typeof value.playerId === "string"
    && isBoolean(value.positionLocked)
    && finite(value.positionX)
    && finite(value.positionZ)
    && isBoolean(value.quizCompleted)
    && isBoolean(value.ready)
    && finite(value.shield)
    && value.weaponId === "bolt";
}

function isArenaProjection(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["configured", "markerExclusionRadiusM", "minimumSpacingM", "radiusM"])
    && isBoolean(value.configured)
    && finite(value.markerExclusionRadiusM)
    && finite(value.minimumSpacingM)
    && finite(value.radiusM);
}

function isQuizProjection(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["currentQuestion", "eligibleCount", "questionCount", "questionEndsAt", "questionIndex", "revealEndsAt", "revealedCorrectOptionId", "revealedExplanation", "status", "submittedCount", "templateId"])) return false;
  const question = value.currentQuestion;
  if (!isRecord(question) || !hasExactKeys(question, ["difficulty", "durationMs", "id", "options", "order", "prompt"]) || !Array.isArray(question.options)) return false;
  return question.options.every((option) => isRecord(option) && hasExactKeys(option, ["id", "label"]) && typeof option.id === "string" && typeof option.label === "string")
    && isOneOf(question.difficulty, ["", "basic", "intermediate", "difficult"])
    && finite(question.durationMs)
    && typeof question.id === "string"
    && Number.isInteger(question.order)
    && typeof question.prompt === "string"
    && isNonNegativeInteger(value.eligibleCount)
    && isNonNegativeInteger(value.questionCount)
    && finite(value.questionEndsAt)
    && Number.isInteger(value.questionIndex)
    && finite(value.revealEndsAt)
    && typeof value.revealedCorrectOptionId === "string"
    && typeof value.revealedExplanation === "string"
    && isOneOf(value.status, ["ready", "question", "reveal", "completed"])
    && isNonNegativeInteger(value.submittedCount)
    && value.templateId === "programming-fundamentals-v1";
}

function isBattleProjection(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["completionReason", "endsAt", "standings", "startsAt", "status", "winnerId"]) || !Array.isArray(value.standings)) return false;
  return value.standings.every((standing) => isStanding(standing))
    && isOneOf(value.completionReason, ["", "last_alive", "timer"])
    && finite(value.endsAt)
    && finite(value.startsAt)
    && isOneOf(value.status, ["not_started", "countdown", "active", "completed"])
    && typeof value.winnerId === "string";
}

/** Validates the complete synchronized Schema projection, including its privacy allow-list. */
export function isPublicRoomStateProjection(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["arena", "battle", "eventSequence", "organizer", "phase", "players", "protocolVersion", "quiz", "roomId", "roundId", "serverNow"]) || !isRecord(value.players)) return false;
  return value.protocolVersion === PROTOCOL_VERSION
    && isArenaProjection(value.arena)
    && isBattleProjection(value.battle)
    && isNonNegativeInteger(value.eventSequence)
    && isOrganizerProjection(value.organizer)
    && isOneOf(value.phase, ["lobby", "quiz", "localization", "positioning", "countdown", "battle", "results"])
    && Object.entries(value.players).every(([playerId, player]) => typeof playerId === "string" && isPlayerProjection(player))
    && isQuizProjection(value.quiz)
    && typeof value.roomId === "string"
    && isPositiveInteger(value.roundId)
    && finite(value.serverNow);
}
