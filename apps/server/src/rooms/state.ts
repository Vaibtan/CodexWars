import { ArraySchema, defineTypes, MapSchema, Schema } from "@colyseus/schema";
import { ARENA, BATTLE, PROTOCOL_VERSION, QUIZ, WEAPONS } from "@codexwars/shared";
import type { BattleStatus, CharacterColorId, CharacterId, CurrentEventsLookbackDays, LocalizationState, QuizCategory, QuizContentMode, QuizDifficulty, QuizDifficultyProfile, QuizStatus, QuizTemplateSource, RoomPhase, WeaponId } from "@codexwars/shared";

export class OrganizerState extends Schema {
  connected = false;
  displayName = "";
}

export class PlayerState extends Schema {
  playerId = "";
  displayName = "";
  connected = true;
  combatIncluded = true;
  quizCompleted = false;
  correctAnswers = 0;
  hasAnsweredCurrent = false;
  localization: LocalizationState = "not_started";
  positionLocked = false;
  positionX = 0;
  positionZ = 0;
  ready = false;
  characterId: CharacterId = "default";
  characterColorId: CharacterColorId = "gold";
  maxHp: number = BATTLE.START_HP;
  hp: number = BATTLE.START_HP;
  shield: number = 0;
  weaponId: WeaponId = "bolt";
  charges: number = WEAPONS.bolt.charges;
  nextAttackAt = 0;
  eliminated = false;
  disconnectedAt = 0;
}

export class ArenaState extends Schema {
  radiusM: number = ARENA.DEFAULT_RADIUS_M;
  minimumSpacingM = ARENA.MIN_SPACING_M;
  markerExclusionRadiusM = ARENA.MARKER_EXCLUSION_RADIUS_M;
  configured = true;
}

export class QuizOptionState extends Schema {
  id = "";
  label = "";
}

export class QuizQuestionState extends Schema {
  id = "";
  order = 0;
  prompt = "";
  options = new ArraySchema<QuizOptionState>();
  difficulty: QuizDifficulty | "" = "";
  durationMs = 0;
}

export class QuizState extends Schema {
  templateId = "";
  status: QuizStatus = "unconfigured";
  contentMode: QuizContentMode | "" = "";
  category: QuizCategory | "" = "";
  difficultyProfile: QuizDifficultyProfile | "" = "";
  currentEventsLookbackDays: CurrentEventsLookbackDays | 0 = 0;
  source: QuizTemplateSource | "" = "";
  regenerationCount = 0;
  questionIndex = -1;
  questionCount = QUIZ.QUESTION_COUNT;
  currentQuestion = new QuizQuestionState();
  questionEndsAt = 0;
  revealEndsAt = 0;
  revealedCorrectOptionId = "";
  revealedExplanation = "";
  submittedCount = 0;
  eligibleCount = 0;
}

export class StandingState extends Schema {
  rank = 0;
  playerId = "";
  displayName = "";
  hp = 0;
  shield = 0;
  correctAnswers = 0;
  eliminated = false;
}

export class BattleState extends Schema {
  status: BattleStatus = "not_started";
  startsAt = 0;
  endsAt = 0;
  winnerId = "";
  completionReason: "" | "last_alive" | "timer" = "";
  standings = new ArraySchema<StandingState>();
}

export class WarRoomState extends Schema {
  protocolVersion = PROTOCOL_VERSION;
  roomId = "";
  phase: RoomPhase = "lobby";
  roundId = 1;
  eventSequence = 0;
  serverNow = 0;
  organizer = new OrganizerState();
  players = new MapSchema<PlayerState>();
  arena = new ArenaState();
  quiz = new QuizState();
  battle = new BattleState();
}

defineTypes(OrganizerState, { connected: "boolean", displayName: "string" });
defineTypes(PlayerState, {
  characterColorId: "string", characterId: "string", charges: "number", combatIncluded: "boolean", connected: "boolean", correctAnswers: "number", disconnectedAt: "number", displayName: "string", eliminated: "boolean", hasAnsweredCurrent: "boolean", hp: "number", localization: "string", maxHp: "number", nextAttackAt: "number", playerId: "string", positionLocked: "boolean", positionX: "number", positionZ: "number", quizCompleted: "boolean", ready: "boolean", shield: "number", weaponId: "string"
});
defineTypes(ArenaState, { configured: "boolean", markerExclusionRadiusM: "number", minimumSpacingM: "number", radiusM: "number" });
defineTypes(QuizOptionState, { id: "string", label: "string" });
defineTypes(QuizQuestionState, { difficulty: "string", durationMs: "number", id: "string", options: [QuizOptionState], order: "number", prompt: "string" });
defineTypes(QuizState, { category: "string", contentMode: "string", currentEventsLookbackDays: "number", currentQuestion: QuizQuestionState, difficultyProfile: "string", eligibleCount: "number", questionCount: "number", questionEndsAt: "number", questionIndex: "number", regenerationCount: "number", revealEndsAt: "number", revealedCorrectOptionId: "string", revealedExplanation: "string", source: "string", status: "string", submittedCount: "number", templateId: "string" });
defineTypes(StandingState, { correctAnswers: "number", displayName: "string", eliminated: "boolean", hp: "number", playerId: "string", rank: "number", shield: "number" });
defineTypes(BattleState, { completionReason: "string", endsAt: "number", standings: [StandingState], startsAt: "number", status: "string", winnerId: "string" });
defineTypes(WarRoomState, { arena: ArenaState, battle: BattleState, eventSequence: "number", organizer: OrganizerState, phase: "string", players: { map: PlayerState }, protocolVersion: "number", quiz: QuizState, roomId: "string", roundId: "number", serverNow: "number" });
