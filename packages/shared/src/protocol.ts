import { CHARACTER_COLOR_IDS, CHARACTER_IDS, CURRENT_EVENTS_LOOKBACK_DAYS, ERROR_CODES, MAX_COMMAND_BYTES, PROTOCOL_VERSION, QUIZ_CATEGORIES, QUIZ_CONTENT_MODES, QUIZ_DIFFICULTY_PROFILES } from "./constants.js";
import type { BattleStatus, CharacterColorId, CharacterId, CommandId, CurrentEventsLookbackDays, ErrorCode, LocalizationState, PlayerId, ProtocolVersion, PublicQuizQuestion, QuizCategory, QuizContentMode, QuizDifficultyProfile, QuizEvidenceSource, QuizStatus, QuizTemplateSource, RoomId, RoomPhase, RoundId, Standing } from "./types.js";

export interface CommandMeta {
  readonly commandId: CommandId;
  readonly roundId: RoundId;
}

export const COMMAND_NAMES = [
  "approve_quiz",
  "attack",
  "cancel_quiz_preparation",
  "configure_arena",
  "configure_quiz",
  "localization_changed",
  "lock_position",
  "prepare_quiz",
  "quiz_answer",
  "ready_changed",
  "regenerate_quiz",
  "reset_round",
  "select_character",
  "set_combat_included",
  "start_battle",
  "start_quiz",
  "unlock_position"
] as const;

export type CommandName = typeof COMMAND_NAMES[number];

export interface CommandPayloads {
  readonly approve_quiz: Readonly<Record<never, never>>;
  readonly attack: { readonly dirX: number; readonly dirZ: number; readonly predictedTargetId?: PlayerId; readonly weaponId: "bolt" };
  readonly cancel_quiz_preparation: Readonly<Record<never, never>>;
  readonly configure_arena: { readonly radiusM: number };
  readonly configure_quiz: { readonly category: QuizCategory; readonly contentMode: QuizContentMode; readonly currentEventsLookbackDays: CurrentEventsLookbackDays; readonly difficultyProfile: QuizDifficultyProfile };
  readonly localization_changed: { readonly state: "searching" | "localized" | "lost" };
  readonly lock_position: { readonly x: number; readonly z: number };
  readonly prepare_quiz: Readonly<Record<never, never>>;
  readonly quiz_answer: { readonly optionId: string; readonly questionId: string };
  readonly ready_changed: { readonly ready: boolean };
  readonly regenerate_quiz: Readonly<Record<never, never>>;
  readonly reset_round: Readonly<Record<never, never>>;
  readonly select_character: { readonly characterId: CharacterId; readonly colorId: CharacterColorId };
  readonly set_combat_included: { readonly included: boolean; readonly playerId: PlayerId };
  readonly start_battle: Readonly<Record<never, never>>;
  readonly start_quiz: Readonly<Record<never, never>>;
  readonly unlock_position: Readonly<Record<never, never>>;
}

export type CommandPayload<Name extends CommandName = CommandName> = CommandMeta & CommandPayloads[Name];
export type CommandEnvelope = { [Name in CommandName]: { readonly name: Name; readonly payload: CommandPayload<Name> } }[CommandName];
export type ValidatedCommand = { [Name in CommandName]: CommandPayload<Name> & { readonly command: Name } }[CommandName];

export function commandEnvelope<Name extends CommandName>(
  name: Name,
  payload: CommandPayloads[Name],
  meta: CommandMeta
): { readonly name: Name; readonly payload: CommandPayload<Name> } {
  return { name, payload: { ...payload, ...meta } };
}

const ORGANIZER_COMMAND_NAMES: ReadonlySet<CommandName> = new Set(["approve_quiz", "cancel_quiz_preparation", "configure_arena", "configure_quiz", "prepare_quiz", "regenerate_quiz", "reset_round", "set_combat_included", "start_battle", "start_quiz"]);
const POSITION_COMMAND_NAMES: ReadonlySet<CommandName> = new Set(["localization_changed", "lock_position", "ready_changed", "unlock_position"]);

export function isOrganizerCommand(name: CommandName): boolean {
  return ORGANIZER_COMMAND_NAMES.has(name);
}

export function isPositionCommand(name: CommandName): boolean {
  return POSITION_COMMAND_NAMES.has(name);
}

export type RuntimeParseResult = { readonly ok: true; readonly value: ValidatedCommand } | { readonly code: "QUIZ_CONFIG_INVALID" | "RATE_LIMITED" | "POSITION_INVALID" | "WEAPON_INVALID"; readonly ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function hasMeta(value: Record<string, unknown>): value is Record<string, unknown> & CommandMeta {
  return typeof value.commandId === "string" && value.commandId.length > 0 && value.commandId.length <= 64 && isPositiveInteger(value.roundId);
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
    case "configure_quiz":
      return only(["category", "contentMode", "currentEventsLookbackDays", "difficultyProfile"])
        && isOneOf(payload.category, QUIZ_CATEGORIES)
        && isOneOf(payload.contentMode, QUIZ_CONTENT_MODES)
        && isOneOf(payload.currentEventsLookbackDays, CURRENT_EVENTS_LOOKBACK_DAYS)
        && isOneOf(payload.difficultyProfile, QUIZ_DIFFICULTY_PROFILES)
        ? { ok: true, value: { ...base, category: payload.category, command: name, contentMode: payload.contentMode, currentEventsLookbackDays: payload.currentEventsLookbackDays, difficultyProfile: payload.difficultyProfile } }
        : { code: "QUIZ_CONFIG_INVALID", ok: false };
    case "approve_quiz":
    case "cancel_quiz_preparation":
    case "prepare_quiz":
    case "regenerate_quiz":
    case "start_quiz":
    case "start_battle":
    case "reset_round":
    case "unlock_position":
      return only([]) ? { ok: true, value: { ...base, command: name } } : { code: "POSITION_INVALID", ok: false };
    case "select_character":
      return only(["characterId", "colorId"])
        && isOneOf(payload.characterId, CHARACTER_IDS)
        && isOneOf(payload.colorId, CHARACTER_COLOR_IDS)
        ? { ok: true, value: { ...base, characterId: payload.characterId, colorId: payload.colorId, command: name } }
        : { code: "POSITION_INVALID", ok: false };
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
      if (!only(["weaponId", "dirX", "dirZ", "predictedTargetId"]) || typeof payload.weaponId !== "string" || !finite(payload.dirX) || !finite(payload.dirZ) || (payload.predictedTargetId !== undefined && typeof payload.predictedTargetId !== "string")) {
        return { code: "POSITION_INVALID", ok: false };
      }
      return payload.weaponId === "bolt"
        ? { ok: true, value: { ...base, command: name, dirX: payload.dirX, dirZ: payload.dirZ, ...(typeof payload.predictedTargetId === "string" ? { predictedTargetId: payload.predictedTargetId } : {}), weaponId: payload.weaponId } }
        : { code: "WEAPON_INVALID", ok: false };
  }
}

export function isSupportedProtocolVersion(value: unknown): value is typeof PROTOCOL_VERSION {
  return value === PROTOCOL_VERSION;
}

export interface SessionRequestPayload {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
}

export function isSessionRequestPayload(value: unknown): value is SessionRequestPayload {
  return isRecord(value)
    && hasExactKeys(value, ["protocolVersion"])
    && isSupportedProtocolVersion(value.protocolVersion);
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

function isPublicQuizQuestionProjection(value: unknown): value is PublicQuizQuestion {
  if (!isRecord(value) || !hasExactKeys(value, ["difficulty", "durationMs", "id", "options", "order", "prompt"]) || !Array.isArray(value.options)) return false;
  return isOneOf(value.difficulty, ["basic", "intermediate", "difficult"])
    && finite(value.durationMs)
    && typeof value.id === "string"
    && value.options.every((option) => isRecord(option) && hasExactKeys(option, ["id", "label"]) && typeof option.id === "string" && typeof option.label === "string")
    && Number.isInteger(value.order)
    && typeof value.prompt === "string";
}

function isQuizEvidenceSource(value: unknown): value is QuizEvidenceSource {
  return isRecord(value)
    && (hasExactKeys(value, ["publisher", "title", "url"]) || hasExactKeys(value, ["publishedAt", "publisher", "title", "url"]))
    && (value.publishedAt === undefined || typeof value.publishedAt === "string")
    && typeof value.publisher === "string"
    && typeof value.title === "string"
    && typeof value.url === "string";
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
  readonly command_accepted: { readonly command: CommandName; readonly commandId: CommandId; readonly roundId: RoundId; readonly serverNow: number };
  readonly quiz_answer_accepted: { readonly acceptedAt: number; readonly commandId: CommandId; readonly questionId: string; readonly roundId: RoundId };
  readonly quiz_answer_result: { readonly correct: boolean; readonly questionId: string; readonly roundId: RoundId; readonly runningCorrectAnswers: number; readonly selectedOptionId?: string };
  readonly quiz_completed: { readonly correctAnswers: number; readonly questionCount: number; readonly roundId: RoundId; readonly startingShield: number };
  readonly quiz_prepared: { readonly generatedAt: number; readonly preparationId: string; readonly questions: readonly PublicQuizQuestion[]; readonly roundId: RoundId; readonly source: QuizTemplateSource; readonly sources: readonly QuizEvidenceSource[]; readonly templateId: string };
  readonly session_ready: { readonly playerId: PlayerId | null; readonly role: "organizer" | "participant" };
}

export type PrivateEventName = keyof PrivateEventPayloads;

export function isPrivateEventPayload<Name extends PrivateEventName>(name: Name, value: unknown): value is PrivateEventPayloads[Name] {
  if (!isRecord(value)) return false;
  switch (name) {
    case "command_accepted":
      return hasExactKeys(value, ["command", "commandId", "roundId", "serverNow"]) && isOneOf(value.command, COMMAND_NAMES) && typeof value.commandId === "string" && isPositiveInteger(value.roundId) && finite(value.serverNow);
    case "quiz_answer_accepted":
      return hasExactKeys(value, ["acceptedAt", "commandId", "questionId", "roundId"]) && finite(value.acceptedAt) && typeof value.commandId === "string" && typeof value.questionId === "string" && isPositiveInteger(value.roundId);
    case "quiz_answer_result":
      return (hasExactKeys(value, ["correct", "questionId", "roundId", "runningCorrectAnswers"]) || hasExactKeys(value, ["correct", "questionId", "roundId", "runningCorrectAnswers", "selectedOptionId"])) && isBoolean(value.correct) && typeof value.questionId === "string" && isPositiveInteger(value.roundId) && isNonNegativeInteger(value.runningCorrectAnswers) && (value.selectedOptionId === undefined || typeof value.selectedOptionId === "string");
    case "quiz_completed":
      return hasExactKeys(value, ["correctAnswers", "questionCount", "roundId", "startingShield"]) && isNonNegativeInteger(value.correctAnswers) && isNonNegativeInteger(value.questionCount) && isPositiveInteger(value.roundId) && isNonNegativeInteger(value.startingShield);
    case "quiz_prepared":
      return hasExactKeys(value, ["generatedAt", "preparationId", "questions", "roundId", "source", "sources", "templateId"])
        && finite(value.generatedAt)
        && typeof value.preparationId === "string"
        && Array.isArray(value.questions)
        && value.questions.every(isPublicQuizQuestionProjection)
        && isPositiveInteger(value.roundId)
        && isOneOf(value.source, ["generated", "fallback"])
        && Array.isArray(value.sources)
        && value.sources.every(isQuizEvidenceSource)
        && typeof value.templateId === "string";
    case "session_ready":
      return hasExactKeys(value, ["playerId", "role"])
        && ((value.role === "organizer" && value.playerId === null) || (value.role === "participant" && typeof value.playerId === "string"));
  }
}

export interface ClientEventPayloads extends PrivateEventPayloads {
  readonly server_error: { readonly code: ErrorCode; readonly commandId?: CommandId; readonly details?: Record<string, unknown>; readonly message: string; readonly retryable: boolean; readonly roundId: RoundId };
}

export type ClientEventName = keyof ClientEventPayloads;

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
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isOneOf<Value extends string | number>(value: unknown, values: readonly Value[]): value is Value {
  return values.some((candidate) => candidate === value);
}

export interface OrganizerPublicState {
  readonly connected: boolean;
  readonly displayName: string;
}

export interface PlayerPublicState {
  readonly characterColorId: CharacterColorId;
  readonly characterId: CharacterId;
  readonly charges: -1;
  readonly combatIncluded: boolean;
  readonly connected: boolean;
  readonly correctAnswers: number;
  readonly disconnectedAt: number;
  readonly displayName: string;
  readonly eliminated: boolean;
  readonly hasAnsweredCurrent: boolean;
  readonly hp: number;
  readonly localization: LocalizationState;
  readonly maxHp: number;
  readonly nextAttackAt: number;
  readonly playerId: PlayerId;
  readonly positionLocked: boolean;
  readonly positionX: number;
  readonly positionZ: number;
  readonly quizCompleted: boolean;
  readonly ready: boolean;
  readonly shield: number;
  readonly weaponId: "bolt";
}

export interface ArenaPublicState {
  readonly configured: boolean;
  readonly markerExclusionRadiusM: number;
  readonly minimumSpacingM: number;
  readonly radiusM: number;
}

export interface QuizPublicState {
  readonly category: QuizCategory | "";
  readonly contentMode: QuizContentMode | "";
  readonly currentQuestion: Omit<PublicQuizQuestion, "difficulty"> & { readonly difficulty: PublicQuizQuestion["difficulty"] | "" };
  readonly currentEventsLookbackDays: CurrentEventsLookbackDays | 0;
  readonly difficultyProfile: QuizDifficultyProfile | "";
  readonly eligibleCount: number;
  readonly questionCount: number;
  readonly questionEndsAt: number;
  readonly questionIndex: number;
  readonly regenerationCount: number;
  readonly revealEndsAt: number;
  readonly revealedCorrectOptionId: string;
  readonly revealedExplanation: string;
  readonly source: QuizTemplateSource | "";
  readonly status: QuizStatus;
  readonly submittedCount: number;
  readonly templateId: string;
}

export interface BattlePublicState {
  readonly completionReason: "" | "last_alive" | "timer";
  readonly endsAt: number;
  readonly standings: readonly Standing[];
  readonly startsAt: number;
  readonly status: BattleStatus;
  readonly winnerId: PlayerId | "";
}

export interface PublicRoomState {
  readonly arena: ArenaPublicState;
  readonly battle: BattlePublicState;
  readonly eventSequence: number;
  readonly organizer: OrganizerPublicState;
  readonly phase: RoomPhase;
  readonly players: Readonly<Record<PlayerId, PlayerPublicState>>;
  readonly protocolVersion: ProtocolVersion;
  readonly quiz: QuizPublicState;
  readonly roomId: RoomId;
  readonly roundId: RoundId;
  readonly serverNow: number;
}

function isOrganizerProjection(value: unknown): value is OrganizerPublicState {
  return isRecord(value) && hasExactKeys(value, ["connected", "displayName"]) && isBoolean(value.connected) && typeof value.displayName === "string";
}

function isPlayerProjection(value: unknown): value is PlayerPublicState {
  return isRecord(value)
    && hasExactKeys(value, ["characterColorId", "characterId", "charges", "combatIncluded", "connected", "correctAnswers", "disconnectedAt", "displayName", "eliminated", "hasAnsweredCurrent", "hp", "localization", "maxHp", "nextAttackAt", "playerId", "positionLocked", "positionX", "positionZ", "quizCompleted", "ready", "shield", "weaponId"])
    && isOneOf(value.characterColorId, CHARACTER_COLOR_IDS)
    && isOneOf(value.characterId, CHARACTER_IDS)
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

function isArenaProjection(value: unknown): value is ArenaPublicState {
  return isRecord(value)
    && hasExactKeys(value, ["configured", "markerExclusionRadiusM", "minimumSpacingM", "radiusM"])
    && isBoolean(value.configured)
    && finite(value.markerExclusionRadiusM)
    && finite(value.minimumSpacingM)
    && finite(value.radiusM);
}

function isQuizProjection(value: unknown): value is QuizPublicState {
  if (!isRecord(value) || !hasExactKeys(value, ["category", "contentMode", "currentEventsLookbackDays", "currentQuestion", "difficultyProfile", "eligibleCount", "questionCount", "questionEndsAt", "questionIndex", "regenerationCount", "revealEndsAt", "revealedCorrectOptionId", "revealedExplanation", "source", "status", "submittedCount", "templateId"])) return false;
  const question = value.currentQuestion;
  if (!isRecord(question) || !hasExactKeys(question, ["difficulty", "durationMs", "id", "options", "order", "prompt"]) || !Array.isArray(question.options)) return false;
  return isOneOf(value.category, ["", ...QUIZ_CATEGORIES])
    && isOneOf(value.contentMode, ["", ...QUIZ_CONTENT_MODES])
    && isOneOf(value.currentEventsLookbackDays, [0, ...CURRENT_EVENTS_LOOKBACK_DAYS])
    && question.options.every((option) => isRecord(option) && hasExactKeys(option, ["id", "label"]) && typeof option.id === "string" && typeof option.label === "string")
    && isOneOf(question.difficulty, ["", "basic", "intermediate", "difficult"])
    && finite(question.durationMs)
    && typeof question.id === "string"
    && Number.isInteger(question.order)
    && typeof question.prompt === "string"
    && isOneOf(value.difficultyProfile, ["", ...QUIZ_DIFFICULTY_PROFILES])
    && isNonNegativeInteger(value.eligibleCount)
    && isNonNegativeInteger(value.questionCount)
    && finite(value.questionEndsAt)
    && Number.isInteger(value.questionIndex)
    && isNonNegativeInteger(value.regenerationCount)
    && finite(value.revealEndsAt)
    && typeof value.revealedCorrectOptionId === "string"
    && typeof value.revealedExplanation === "string"
    && isOneOf(value.source, ["", "generated", "fallback"])
    && isOneOf(value.status, ["unconfigured", "configured", "generating", "awaiting_approval", "ready", "fallback_ready", "question", "reveal", "completed"])
    && isNonNegativeInteger(value.submittedCount)
    && typeof value.templateId === "string";
}

function isBattleProjection(value: unknown): value is BattlePublicState {
  if (!isRecord(value) || !hasExactKeys(value, ["completionReason", "endsAt", "standings", "startsAt", "status", "winnerId"]) || !Array.isArray(value.standings)) return false;
  return value.standings.every((standing) => isStanding(standing))
    && isOneOf(value.completionReason, ["", "last_alive", "timer"])
    && finite(value.endsAt)
    && finite(value.startsAt)
    && isOneOf(value.status, ["not_started", "countdown", "active", "completed"])
    && typeof value.winnerId === "string";
}

/** Validates the complete synchronized Schema projection, including its privacy allow-list. */
export function isPublicRoomStateProjection(value: unknown): value is PublicRoomState {
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
