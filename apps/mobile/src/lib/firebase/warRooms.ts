import type {
  AnnounceJoinRoomCommand,
  ArenaPosition,
  AttackRoomCommand,
  CharacterSelection,
  CompleteQuizRoomCommand,
  EndBattleRoomCommand,
  LockPositionRoomCommand,
  OpenQuizQuestionRoomCommand,
  ScoreQuizQuestionRoomCommand,
  SelectCharacterRoomCommand,
  SetArenaReadyRoomCommand,
  StartBattleSetupRoomCommand,
  StartBattleRoomCommand,
  StartQuizRoomCommand,
  WarRoomCommand,
  WarRoomEvent,
  WarRoomMember,
  WarRoomState,
  WeaponId,
} from "@codexwars/shared";
import { resolveWarRoomCommand } from "@codexwars/shared";
import {
  get,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Unsubscribe,
} from "firebase/database";
import type { WarRoomSession } from "../../features/warRoom/types";
import { ensureAnonymousFirebaseUser, getFirebaseServices } from "./client";

const ROOM_CODE_DIGITS = 6;
const DEFAULT_ARENA_RADIUS_M = 5;
type CommandInputKeys = "actorId" | "createdAt" | "id" | "roundId" | "status";
type WarRoomCommandInput =
  | Omit<AnnounceJoinRoomCommand, CommandInputKeys>
  | Omit<AttackRoomCommand, CommandInputKeys>
  | Omit<CompleteQuizRoomCommand, CommandInputKeys>
  | Omit<EndBattleRoomCommand, CommandInputKeys>
  | Omit<LockPositionRoomCommand, CommandInputKeys>
  | Omit<OpenQuizQuestionRoomCommand, CommandInputKeys>
  | Omit<ScoreQuizQuestionRoomCommand, CommandInputKeys>
  | Omit<SelectCharacterRoomCommand, CommandInputKeys>
  | Omit<SetArenaReadyRoomCommand, CommandInputKeys>
  | Omit<StartBattleSetupRoomCommand, CommandInputKeys>
  | Omit<StartBattleRoomCommand, CommandInputKeys>
  | Omit<StartQuizRoomCommand, CommandInputKeys>;

function firebaseDatabase() {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase Realtime Database is not configured.");
  }
  return services.database;
}

function normalizeCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, ROOM_CODE_DIGITS);
}

function randomRoomCode(): string {
  return String(Math.floor(10 ** (ROOM_CODE_DIGITS - 1) + Math.random() * 9 * 10 ** (ROOM_CODE_DIGITS - 1)));
}

function normalizeRoom(value: Partial<WarRoomState>): WarRoomState {
  return {
    ...value,
    commands: value.commands ?? {},
    events: value.events ?? {},
    members: value.members ?? {},
    quiz: value.quiz ?? {
      completedQuestionCount: 0,
      correctOptionId: null,
      currentQuestionId: null,
      currentQuestionIndex: -1,
      questionCount: 10,
      questionEndsAt: null,
      revealEndsAt: null,
      scores: {},
      status: "waiting",
    },
    results: value.results ?? null,
    stats: value.stats ?? {},
  } as WarRoomState;
}

function roomCreatedEvent(organizerId: string, nowMs: number): WarRoomEvent {
  return {
    actorId: organizerId,
    commandId: null,
    createdAt: nowMs,
    id: "00000001_room-created",
    message: "Organizer created the War Room",
    revision: 1,
    roundId: 1,
    sequence: 1,
    type: "room_created",
  };
}

export async function createWarRoom(organizerName: string): Promise<WarRoomSession> {
  const user = await ensureAnonymousFirebaseUser();
  if (!user) throw new Error("Anonymous Firebase authentication is required.");
  const database = firebaseDatabase();
  const nowMs = Date.now();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomRoomCode();
    const initial: WarRoomState = {
      arena: { radiusM: DEFAULT_ARENA_RADIUS_M, scannedAt: null, status: "unconfigured" },
      battleEndsAt: null,
      battleStartsAt: null,
      code,
      commands: {},
      createdAt: nowMs,
      eventSequence: 1,
      events: { "00000001_room-created": roomCreatedEvent(user.uid, nowMs) },
      members: {},
      organizerId: user.uid,
      organizerName: organizerName.trim() || "Organizer",
      phase: "lobby",
      quiz: {
        completedQuestionCount: 0,
        correctOptionId: null,
        currentQuestionId: null,
        currentQuestionIndex: -1,
        questionCount: 10,
        questionEndsAt: null,
        revealEndsAt: null,
        scores: {},
        status: "waiting",
      },
      revision: 1,
      results: null,
      roomId: code,
      roundId: 1,
      stats: {},
      updatedAt: nowMs,
      version: 1,
    };
    const result = await runTransaction(
      ref(database, `warRooms/${code}`),
      (current) => current ?? initial,
      { applyLocally: false },
    );
    if (result.committed && result.snapshot.val()?.organizerId === user.uid) {
      await set(ref(database, `roomDirectory/${code}`), {
        createdAt: nowMs,
        organizerId: user.uid,
        roomId: code,
      });
      return { nickname: initial.organizerName, role: "organizer", roomId: code, uid: user.uid };
    }
  }

  throw new Error("Unable to allocate a unique room code. Please retry.");
}

export async function joinWarRoom(roomCode: string, nickname: string): Promise<WarRoomSession> {
  const user = await ensureAnonymousFirebaseUser();
  if (!user) throw new Error("Anonymous Firebase authentication is required.");
  const code = normalizeCode(roomCode);
  if (code.length !== ROOM_CODE_DIGITS) throw new Error("Enter the six-digit room code.");
  const database = firebaseDatabase();
  const directorySnapshot = await get(ref(database, `roomDirectory/${code}`));
  if (!directorySnapshot.exists()) throw new Error("War Room not found.");
  if (directorySnapshot.val()?.organizerId === user.uid) throw new Error("The organizer account cannot join as a participant.");

  const nowMs = Date.now();
  const member: WarRoomMember = {
    combatIncluded: true,
    connected: true,
    correctAnswers: null,
    id: user.uid,
    joinedAt: nowMs,
    nickname: nickname.trim() || "Participant",
    position: null,
    quizCompleted: false,
    readiness: "customizing",
    selection: null,
    totalQuestions: null,
    updatedAt: nowMs,
  };
  const memberRef = ref(database, `warRooms/${code}/members/${user.uid}`);
  await set(memberRef, member);
  await onDisconnect(memberRef).update({ connected: false, updatedAt: serverTimestamp() });

  const roomSnapshot = await get(ref(database, `warRooms/${code}`));
  if (roomSnapshot.exists()) {
    await submitCommand(
      { nickname: member.nickname, role: "participant", roomId: code, uid: user.uid },
      normalizeRoom(roomSnapshot.val() as Partial<WarRoomState>),
      { type: "announce_join" },
    );
  }

  return { nickname: member.nickname, role: "participant", roomId: code, uid: user.uid };
}

export function subscribeToWarRoom(
  roomId: string,
  onRoom: (room: WarRoomState | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(firebaseDatabase(), `warRooms/${normalizeCode(roomId)}`),
    (snapshot) => onRoom(snapshot.exists() ? normalizeRoom(snapshot.val() as Partial<WarRoomState>) : null),
    (error) => onError?.(error),
  );
}

export function subscribeToFirebaseConnection(onConnected: (connected: boolean) => void): Unsubscribe {
  return onValue(ref(firebaseDatabase(), ".info/connected"), (snapshot) => onConnected(snapshot.val() === true));
}

export async function markSessionConnected(session: WarRoomSession): Promise<void> {
  if (session.role !== "participant") return;
  const memberRef = ref(firebaseDatabase(), `warRooms/${session.roomId}/members/${session.uid}`);
  await update(memberRef, { connected: true, updatedAt: serverTimestamp() });
  await onDisconnect(memberRef).update({ connected: false, updatedAt: serverTimestamp() });
}

async function submitCommand(
  session: WarRoomSession,
  room: WarRoomState,
  command: WarRoomCommandInput,
): Promise<string> {
  const commandRef = push(ref(firebaseDatabase(), `warRooms/${session.roomId}/commands`));
  if (!commandRef.key) throw new Error("Unable to allocate a command identifier.");
  const value: WarRoomCommand = {
    ...command,
    actorId: session.uid,
    createdAt: Date.now(),
    id: commandRef.key,
    roundId: room.roundId,
    status: "pending",
  } as WarRoomCommand;
  await set(commandRef, value);
  return commandRef.key;
}

export function selectCharacter(session: WarRoomSession, room: WarRoomState, selection: CharacterSelection) {
  return submitCommand(session, room, { selection, type: "select_character" });
}

export function lockPosition(session: WarRoomSession, room: WarRoomState, position: ArenaPosition) {
  return submitCommand(session, room, { position, type: "lock_position" });
}

export function setArenaReady(session: WarRoomSession, room: WarRoomState, radiusM = DEFAULT_ARENA_RADIUS_M) {
  return submitCommand(session, room, { radiusM, type: "set_arena_ready" });
}

export function startBattle(session: WarRoomSession, room: WarRoomState, durationMs = 60_000) {
  return submitCommand(session, room, { durationMs, type: "start_battle" });
}

export function attackParticipant(
  session: WarRoomSession,
  room: WarRoomState,
  direction: { dirX: number; dirZ: number; predictedTargetId?: string },
  weaponId: WeaponId,
) {
  return submitCommand(session, room, { ...direction, type: "attack", weaponId });
}

export function endBattle(session: WarRoomSession, room: WarRoomState) {
  return submitCommand(session, room, { reason: "organizer_ended", type: "end_battle" });
}

export interface WarRoomCommandReceipt {
  commandId: string;
  rejectionCode?: string;
  status: "resolved" | "rejected";
}

export function waitForCommandResolution(
  roomId: string,
  commandId: string,
  timeoutMs = 15_000,
): Promise<WarRoomCommandReceipt> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: Unsubscribe = () => undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      unsubscribe();
      callback();
    };
    unsubscribe = onValue(
      ref(firebaseDatabase(), `warRooms/${normalizeCode(roomId)}/commands/${commandId}`),
      (snapshot) => {
        const command = snapshot.val() as WarRoomCommand | null;
        if (command?.status !== "resolved" && command?.status !== "rejected") return;
        finish(() => resolve({
          commandId,
          ...(command.rejectionCode ? { rejectionCode: command.rejectionCode } : {}),
          status: command.status === "resolved" ? "resolved" : "rejected",
        }));
      },
      (error) => finish(() => reject(error)),
    );
    if (settled) {
      unsubscribe();
      return;
    }
    timeout = setTimeout(() => finish(() => reject(new Error(`Command ${commandId} was not resolved in time.`))), timeoutMs);
  });
}

export function startQuiz(session: WarRoomSession, room: WarRoomState) {
  return submitCommand(session, room, { questionCount: 10, type: "start_quiz" });
}

export function openQuizQuestion(
  session: WarRoomSession,
  room: WarRoomState,
  questionId: string,
  questionIndex: number,
  endsAt: number,
) {
  return submitCommand(session, room, { endsAt, questionId, questionIndex, type: "open_quiz_question" });
}

export function completeQuiz(session: WarRoomSession, room: WarRoomState) {
  return submitCommand(session, room, { type: "complete_quiz" });
}

export function startBattleSetup(session: WarRoomSession, room: WarRoomState) {
  return submitCommand(session, room, { type: "start_battle_setup" });
}

export interface QuizAnswerRecord {
  optionId: string;
  participantId: string;
  submittedAt: number;
}

export async function submitQuizAnswer(
  session: WarRoomSession,
  room: WarRoomState,
  optionId: string,
): Promise<void> {
  if (session.role !== "participant") throw new Error("Only participants submit quiz answers.");
  const questionId = room.quiz.currentQuestionId;
  if (room.phase !== "quiz" || room.quiz.status !== "open" || !questionId) {
    throw new Error("There is no open quiz question.");
  }
  const answer: QuizAnswerRecord = { optionId, participantId: session.uid, submittedAt: Date.now() };
  const result = await runTransaction(
    ref(firebaseDatabase(), `quizAnswers/${room.roomId}/${questionId}/${session.uid}`),
    (current) => current ?? answer,
    { applyLocally: false },
  );
  if (!result.committed) throw new Error("An answer was already submitted for this question.");
}

export async function scoreQuizQuestion(
  session: WarRoomSession,
  room: WarRoomState,
  correctOptionId: string,
  revealEndsAt: number,
): Promise<string> {
  if (session.role !== "organizer") throw new Error("Only the organizer can score a question.");
  const questionId = room.quiz.currentQuestionId;
  if (!questionId || room.quiz.status !== "open") throw new Error("There is no open question to score.");
  const closed = await runTransaction(
    ref(firebaseDatabase(), `warRooms/${room.roomId}`),
    (current) => {
      if (!current) return current;
      const latest = normalizeRoom(current as Partial<WarRoomState>);
      if (latest.organizerId !== session.uid
        || latest.quiz.status !== "open"
        || latest.quiz.currentQuestionId !== questionId) return;
      return {
        ...latest,
        quiz: { ...latest.quiz, questionEndsAt: null, status: "closed" },
        revision: latest.revision + 1,
        updatedAt: Date.now(),
      };
    },
    { applyLocally: false },
  );
  if (!closed.committed) throw new Error("The question could not be closed for scoring.");
  const snapshot = await get(ref(firebaseDatabase(), `quizAnswers/${room.roomId}/${questionId}`));
  const answers = (snapshot.val() ?? {}) as Record<string, QuizAnswerRecord>;
  const outcomes = Object.fromEntries(Object.keys(room.members).map((memberId) => [
    memberId,
    answers[memberId]?.optionId === correctOptionId,
  ]));
  const closedRoom = normalizeRoom(closed.snapshot.val() as Partial<WarRoomState>);
  return submitCommand(session, closedRoom, {
    correctOptionId,
    outcomes,
    questionId,
    revealEndsAt,
    type: "score_quiz_question",
  });
}

/**
 * Runs only on the organizer device. Every pending intent is resolved inside one
 * RTDB transaction, so retries are deterministic and command IDs are idempotent.
 */
export function startOrganizerAuthority(
  session: WarRoomSession,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (session.role !== "organizer") return () => undefined;
  const database = firebaseDatabase();
  return onChildAdded(ref(database, `warRooms/${session.roomId}/commands`), (snapshot) => {
    const commandId = snapshot.key;
    if (!commandId || snapshot.val()?.status !== "pending") return;
    void runTransaction(
      ref(database, `warRooms/${session.roomId}`),
      (current) => {
        if (!current) return current;
        const room = normalizeRoom(current as Partial<WarRoomState>);
        if (room.organizerId !== session.uid || room.commands[commandId]?.status !== "pending") return room;
        return resolveWarRoomCommand(room, commandId, Date.now()).room;
      },
      { applyLocally: false },
    ).catch((error: unknown) => onError?.(error instanceof Error ? error : new Error(String(error))));
  });
}
