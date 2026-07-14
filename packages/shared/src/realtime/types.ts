import type { BattleLoadout, DamageResolution, WeaponId } from "../battle/types.js";
import type {
  ArenaPosition,
  CharacterSelection,
  ParticipantReadiness,
  RoomPhase,
} from "../index.js";

export type WarRoomId = string;
export type WarRoomCommandStatus = "pending" | "resolved" | "rejected";

export interface WarRoomMember {
  combatIncluded: boolean;
  connected: boolean;
  correctAnswers: number | null;
  id: string;
  joinedAt: number;
  nickname: string;
  position: ArenaPosition | null;
  quizCompleted: boolean;
  readiness: ParticipantReadiness;
  selection: CharacterSelection | null;
  totalQuestions: number | null;
  updatedAt: number;
}

export interface WarRoomArena {
  radiusM: number;
  scannedAt: number | null;
  status: "unconfigured" | "scanning" | "ready";
}

interface WarRoomCommandBase {
  actorId: string;
  createdAt: number;
  id: string;
  rejectionCode?: WarRoomRejectionCode;
  resolvedAt?: number;
  roundId: number;
  status: WarRoomCommandStatus;
}

export interface SelectCharacterRoomCommand extends WarRoomCommandBase {
  selection: CharacterSelection;
  type: "select_character";
}

export interface AnnounceJoinRoomCommand extends WarRoomCommandBase {
  type: "announce_join";
}

export interface SetLobbyReadyRoomCommand extends WarRoomCommandBase {
  ready: boolean;
  type: "set_lobby_ready";
}

export interface LockPositionRoomCommand extends WarRoomCommandBase {
  position: ArenaPosition;
  type: "lock_position";
}

export interface SetArenaReadyRoomCommand extends WarRoomCommandBase {
  radiusM: number;
  type: "set_arena_ready";
}

export interface StartBattleRoomCommand extends WarRoomCommandBase {
  durationMs: number;
  type: "start_battle";
}

export interface AttackRoomCommand extends WarRoomCommandBase {
  dirX: number;
  dirZ: number;
  predictedTargetId?: string;
  type: "attack";
  weaponId: WeaponId;
}

export interface StartQuizRoomCommand extends WarRoomCommandBase {
  questionCount: 10;
  type: "start_quiz";
}

export interface OpenQuizQuestionRoomCommand extends WarRoomCommandBase {
  endsAt: number;
  questionId: string;
  questionIndex: number;
  type: "open_quiz_question";
}

export interface ScoreQuizQuestionRoomCommand extends WarRoomCommandBase {
  correctOptionId: string;
  outcomes: Record<string, boolean>;
  questionId: string;
  revealEndsAt: number;
  type: "score_quiz_question";
}

export interface CompleteQuizRoomCommand extends WarRoomCommandBase {
  type: "complete_quiz";
}

export interface StartBattleSetupRoomCommand extends WarRoomCommandBase {
  type: "start_battle_setup";
}

export interface EndBattleRoomCommand extends WarRoomCommandBase {
  reason: "organizer_ended" | "timer_expired";
  type: "end_battle";
}

export type WarRoomCommand =
  | AnnounceJoinRoomCommand
  | AttackRoomCommand
  | CompleteQuizRoomCommand
  | EndBattleRoomCommand
  | LockPositionRoomCommand
  | OpenQuizQuestionRoomCommand
  | ScoreQuizQuestionRoomCommand
  | SelectCharacterRoomCommand
  | SetLobbyReadyRoomCommand
  | SetArenaReadyRoomCommand
  | StartBattleSetupRoomCommand
  | StartBattleRoomCommand
  | StartQuizRoomCommand;

export type WarRoomEventType =
  | "arena_ready"
  | "attack_applied"
  | "attack_missed"
  | "battle_completed"
  | "battle_setup_started"
  | "battle_started"
  | "character_selected"
  | "command_rejected"
  | "participant_joined"
  | "participant_ready_changed"
  | "position_locked"
  | "quiz_completed"
  | "quiz_question_opened"
  | "quiz_question_scored"
  | "quiz_started"
  | "room_created";

export interface WarRoomEvent {
  actorId: string;
  commandId: string | null;
  createdAt: number;
  damage?: DamageResolution;
  id: string;
  message: string;
  rejectionCode?: WarRoomRejectionCode;
  revision: number;
  roundId: number;
  sequence: number;
  targetId?: string;
  type: WarRoomEventType;
  weaponId?: WeaponId;
}

export type WarRoomRejectionCode =
  | "ACTOR_NOT_MEMBER"
  | "ARENA_NOT_READY"
  | "BATTLE_NOT_ACTIVE"
  | "INVALID_ARENA"
  | "INVALID_PHASE"
  | "INVALID_POSITION"
  | "INVALID_QUIZ_STATE"
  | "INVALID_ROUND"
  | "NOT_ORGANIZER"
  | "PARTICIPANTS_NOT_READY"
  | "QUIZ_NOT_COMPLETE"
  | "SELF_TARGET"
  | "TARGET_NOT_MEMBER"
  | "UNSUPPORTED_COMMAND"
  | `ATTACK_${string}`;

export interface WarRoomQuizState {
  completedQuestionCount: number;
  correctOptionId: string | null;
  currentQuestionId: string | null;
  currentQuestionIndex: number;
  questionCount: 10;
  questionEndsAt: number | null;
  revealEndsAt: number | null;
  scores: Record<string, number>;
  status: "waiting" | "open" | "closed" | "reveal" | "completed";
}

export interface WarRoomStanding {
  correctAnswers: number;
  eliminated: boolean;
  hp: number;
  nickname: string;
  participantId: string;
  rank: number;
  shield: number;
}

export interface WarRoomResults {
  completedAt: number;
  standings: Record<string, WarRoomStanding>;
  winnerId: string | null;
}

export interface WarRoomState {
  arena: WarRoomArena;
  battleEndsAt: number | null;
  battleStartsAt: number | null;
  code: string;
  commands: Record<string, WarRoomCommand>;
  createdAt: number;
  eventSequence: number;
  events: Record<string, WarRoomEvent>;
  members: Record<string, WarRoomMember>;
  organizerId: string;
  organizerName: string;
  phase: RoomPhase;
  quiz: WarRoomQuizState;
  revision: number;
  results: WarRoomResults | null;
  roomId: WarRoomId;
  roundId: number;
  stats: Record<string, BattleLoadout>;
  updatedAt: number;
  version: 1;
}

export interface WarRoomCommandResolution {
  eventIds: string[];
  room: WarRoomState;
  status: "applied" | "duplicate" | "rejected";
}
