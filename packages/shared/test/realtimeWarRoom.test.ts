import { describe, expect, it } from "vitest";
import {
  resolveWarRoomCommand,
  type WarRoomCommand,
  type WarRoomMember,
  type WarRoomState,
} from "../src/index.js";

const now = 10_000;

function member(id: string, nickname: string, x: number): WarRoomMember {
  return {
    combatIncluded: true,
    connected: true,
    correctAnswers: 7,
    id,
    joinedAt: 1,
    nickname,
    position: { x, z: 0 },
    quizCompleted: true,
    readiness: "waiting",
    selection: { characterId: "knight", colorId: "gold" },
    totalQuestions: 10,
    updatedAt: 1,
  };
}

function roomWith(command: WarRoomCommand, phase: WarRoomState["phase"] = "battle"): WarRoomState {
  return {
    arena: { radiusM: 5, scannedAt: 5, status: "ready" },
    battleEndsAt: phase === "battle" ? now + 60_000 : null,
    battleStartsAt: phase === "battle" ? now - 1_000 : null,
    code: "482731",
    commands: { [command.id]: command },
    createdAt: 1,
    eventSequence: 0,
    events: {},
    members: { alpha: member("alpha", "Alpha", -1), beta: member("beta", "Beta", 1) },
    organizerId: "organizer",
    organizerName: "Organizer",
    phase,
    quiz: {
      completedQuestionCount: 10,
      correctOptionId: "b",
      currentQuestionId: "q10",
      currentQuestionIndex: 9,
      questionCount: 10,
      questionEndsAt: null,
      revealEndsAt: null,
      scores: { alpha: 7, beta: 7 },
      status: "completed",
    },
    revision: 0,
    results: null,
    roomId: "482731",
    roundId: 1,
    stats: {},
    updatedAt: 1,
    version: 1,
  };
}

function pending<T extends WarRoomCommand>(command: Omit<T, "createdAt" | "roundId" | "status">): T {
  return { ...command, createdAt: now - 10, roundId: 1, status: "pending" } as T;
}

describe("resolveWarRoomCommand", () => {
  it("orchestrates ten questions and derives every participant's battle stats", () => {
    const start = pending<Extract<WarRoomCommand, { type: "start_quiz" }>>({
      actorId: "organizer",
      id: "quiz-start",
      questionCount: 10,
      type: "start_quiz",
    });
    let state = roomWith(start, "lobby");
    state = {
      ...state,
      members: Object.fromEntries(Object.entries(state.members).map(([id, value]) => [id, {
        ...value,
        correctAnswers: null,
        position: null,
        quizCompleted: false,
        readiness: "quiz-ready" as const,
        selection: null,
        totalQuestions: null,
      }])),
      quiz: { ...state.quiz, completedQuestionCount: 0, correctOptionId: null, currentQuestionId: null, currentQuestionIndex: -1, scores: {}, status: "waiting" },
    };
    state = resolveWarRoomCommand(state, start.id, now).room;

    for (let index = 0; index < 10; index += 1) {
      const open = pending<Extract<WarRoomCommand, { type: "open_quiz_question" }>>({
        actorId: "organizer",
        endsAt: now + 30_000 + index,
        id: `open-${index}`,
        questionId: `q${index}`,
        questionIndex: index,
        type: "open_quiz_question",
      });
      state = resolveWarRoomCommand({ ...state, commands: { ...state.commands, [open.id]: open } }, open.id, now + index).room;
      state = { ...state, quiz: { ...state.quiz, status: "closed" } };
      const score = pending<Extract<WarRoomCommand, { type: "score_quiz_question" }>>({
        actorId: "organizer",
        correctOptionId: "b",
        id: `score-${index}`,
        outcomes: { alpha: index < 7, beta: index < 3 },
        questionId: `q${index}`,
        revealEndsAt: now + 35_000 + index,
        type: "score_quiz_question",
      });
      state = resolveWarRoomCommand({ ...state, commands: { ...state.commands, [score.id]: score } }, score.id, now + index).room;
    }

    const complete = pending<Extract<WarRoomCommand, { type: "complete_quiz" }>>({
      actorId: "organizer",
      id: "quiz-complete",
      type: "complete_quiz",
    });
    state = resolveWarRoomCommand({ ...state, commands: { ...state.commands, [complete.id]: complete } }, complete.id, now + 20).room;

    expect(state.phase).toBe("quiz-results");
    expect(state.members.alpha).toMatchObject({ correctAnswers: 7, quizCompleted: true, totalQuestions: 10 });
    expect(state.members.beta).toMatchObject({ correctAnswers: 3, quizCompleted: true, totalQuestions: 10 });
    expect(state.stats.alpha.maxShield).toBeGreaterThan(state.stats.beta.maxShield);
  });

  it("requires every connected participant to mark ready before the organizer starts the quiz", () => {
    const ready = pending<Extract<WarRoomCommand, { type: "set_lobby_ready" }>>({
      actorId: "alpha",
      id: "alpha-ready",
      ready: true,
      type: "set_lobby_ready",
    });
    let state = roomWith(ready, "lobby");
    state = {
      ...state,
      members: {
        ...state.members,
        alpha: { ...state.members.alpha, readiness: "lobby" },
        beta: { ...state.members.beta, readiness: "lobby" },
      },
      quiz: { ...state.quiz, completedQuestionCount: 0, status: "waiting" },
    };
    state = resolveWarRoomCommand(state, ready.id, now).room;
    expect(state.members.alpha.readiness).toBe("quiz-ready");
    expect(Object.values(state.events).at(-1)?.type).toBe("participant_ready_changed");

    const start = pending<Extract<WarRoomCommand, { type: "start_quiz" }>>({
      actorId: "organizer",
      id: "start-before-beta-ready",
      questionCount: 10,
      type: "start_quiz",
    });
    const rejected = resolveWarRoomCommand({ ...state, commands: { ...state.commands, [start.id]: start } }, start.id, now + 1);
    expect(rejected.status).toBe("rejected");
    expect(rejected.room.commands[start.id].rejectionCode).toBe("PARTICIPANTS_NOT_READY");
  });

  it("starts only when the arena and every combat participant are ready", () => {
    const command = pending<Extract<WarRoomCommand, { type: "start_battle" }>>({
      actorId: "organizer",
      durationMs: 60_000,
      id: "start-1",
      type: "start_battle",
    });
    const result = resolveWarRoomCommand(roomWith(command, "positioning"), command.id, now);

    expect(result.status).toBe("applied");
    expect(result.room.phase).toBe("battle");
    expect(Object.keys(result.room.stats)).toEqual(["alpha", "beta"]);
    expect(Object.values(result.room.events)[0]).toMatchObject({ type: "battle_started" });
  });

  it("atomically applies shield-first damage and records the matching event", () => {
    const command = pending<Extract<WarRoomCommand, { type: "attack" }>>({
      actorId: "alpha",
      dirX: 1,
      dirZ: 0,
      id: "attack-1",
      type: "attack",
      weaponId: "bolt",
    });
    const started = resolveWarRoomCommand(
      roomWith(pending<Extract<WarRoomCommand, { type: "start_battle" }>>({
        actorId: "organizer",
        durationMs: 60_000,
        id: "start-1",
        type: "start_battle",
      }), "positioning"),
      "start-1",
      now - 100,
    ).room;
    const attackRoom = { ...started, commands: { ...started.commands, [command.id]: command } };
    const result = resolveWarRoomCommand(attackRoom, command.id, now);

    expect(result.room.stats.beta).toMatchObject({ hp: 100, shield: 8 });
    expect(result.room.stats.alpha.weapons.bolt.nextReadyAtMs).toBe(now + 1_000);
    expect(result.room.events[result.eventIds[0]]).toMatchObject({
      actorId: "alpha",
      damage: { hpDamage: 0, shieldDamage: 12 },
      targetId: "beta",
      type: "attack_applied",
    });
  });

  it("deduplicates an already-resolved command without adding damage or events", () => {
    const command = pending<Extract<WarRoomCommand, { type: "attack" }>>({
      actorId: "alpha",
      dirX: 1,
      dirZ: 0,
      id: "attack-1",
      type: "attack",
      weaponId: "bolt",
    });
    const seeded = roomWith({ ...command, resolvedAt: now, status: "resolved" });
    const result = resolveWarRoomCommand(seeded, command.id, now + 1);

    expect(result).toEqual({ eventIds: [], room: seeded, status: "duplicate" });
  });

  it("consumes a weapon use and logs a miss when no opponent intersects the aim ray", () => {
    const command = pending<Extract<WarRoomCommand, { type: "attack" }>>({
      actorId: "alpha",
      dirX: 0,
      dirZ: 1,
      id: "miss-1",
      type: "attack",
      weaponId: "bolt",
    });
    const started = resolveWarRoomCommand(
      roomWith(pending<Extract<WarRoomCommand, { type: "start_battle" }>>({
        actorId: "organizer",
        durationMs: 60_000,
        id: "start-miss",
        type: "start_battle",
      }), "positioning"),
      "start-miss",
      now - 100,
    ).room;
    const result = resolveWarRoomCommand({ ...started, commands: { ...started.commands, [command.id]: command } }, command.id, now);
    expect(result.room.stats.alpha.weapons.bolt.nextReadyAtMs).toBe(now + 1_000);
    expect(result.room.events[result.eventIds[0]]).toMatchObject({ type: "attack_missed" });
  });

  it("rejects unsafe overlapping positions and logs the rejection", () => {
    const command = pending<Extract<WarRoomCommand, { type: "lock_position" }>>({
      actorId: "alpha",
      id: "position-1",
      position: { x: 1.2, z: 0 },
      type: "lock_position",
    });
    const result = resolveWarRoomCommand(roomWith(command, "positioning"), command.id, now);

    expect(result.status).toBe("rejected");
    expect(result.room.commands[command.id]).toMatchObject({ rejectionCode: "INVALID_POSITION", status: "rejected" });
    expect(result.room.events[result.eventIds[0]]).toMatchObject({ type: "command_rejected" });
  });
});
