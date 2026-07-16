import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { PROGRAMMING_FUNDAMENTALS_V1 } from "@codexwars/shared";
import appConfig from "../src/app.config.js";
import { setWarRoomDependenciesForTest, type WarRoom } from "../src/rooms/war-room.js";
import { WarRoomHarness } from "./support/war-room-harness.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(appConfig);
});

afterAll(async () => {
  await colyseus.shutdown();
});

beforeEach(async () => {
  await colyseus.cleanup();
});

describe("War Room negative paths", () => {
  it("rejects an unsupported protocol version before binding a role", async () => {
    const room = await colyseus.createRoom<WarRoom>("war", { displayName: "Teacher", protocolVersion: 1 });

    await expect(colyseus.connectTo(room, { displayName: "Teacher", protocolVersion: 2 })).rejects.toThrow("CLIENT_VERSION_UNSUPPORTED");
    expect(room.state.organizer.connected).toBe(false);
    expect(room.state.players.size).toBe(0);
  });

  it("rejects control characters and nicknames longer than twenty Unicode characters", async () => {
    const controlRoom = await colyseus.createRoom<WarRoom>("war", { displayName: "Teacher", protocolVersion: 1 });
    await expect(colyseus.connectTo(controlRoom, { displayName: "Ada\u0000", protocolVersion: 1 })).rejects.toThrow("NICKNAME_INVALID");

    const longRoom = await colyseus.createRoom<WarRoom>("war", { displayName: "Teacher", protocolVersion: 1 });
    await expect(colyseus.connectTo(longRoom, { displayName: "A".repeat(21), protocolVersion: 1 })).rejects.toThrow("NICKNAME_INVALID");
  });

  it("admits twelve participants, suffixes duplicate nicknames, and rejects participant thirteen", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    for (let index = 0; index < 12; index += 1) {
      await harness.joinParticipant(index < 2 ? "Ada" : `Participant ${index + 1}`);
    }

    expect([...harness.room.state.players.values()].slice(0, 2).map((player) => player.displayName)).toEqual(["Ada", "Ada (2)"]);
    await expect(harness.joinParticipant("Participant 13")).rejects.toThrow(/locked/iu);
    expect(harness.room.state.players.size).toBe(12);
  });

  it("rejects an unknown room and a room that has left the lobby", async () => {
    await expect(colyseus.sdk.joinById("missing-room", { displayName: "Ada", protocolVersion: 1 })).rejects.toThrow(/not found/iu);

    const harness = await WarRoomHarness.create(colyseus);
    await harness.joinParticipant("Ada");
    await harness.sendAndPatch(harness.organizer, "start_quiz", harness.command());

    await expect(harness.joinParticipant("Grace")).rejects.toThrow("ROOM_NOT_JOINABLE");
  });

  it("returns structured errors for oversize payloads, stale rounds, and role tampering", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");

    await expect(harness.commandError(participant, "select_character", {
      ...harness.command("oversize"),
      characterId: "knight",
      colorId: "gold",
      padding: "x".repeat(3_000)
    })).resolves.toMatchObject({ code: "RATE_LIMITED", retryable: true, roundId: 1 });

    const stale = { commandId: "stale-round", ready: true, roundId: 2 };
    await expect(harness.commandError(participant, "ready_changed", stale)).resolves.toMatchObject({
      code: "ROUND_MISMATCH",
      commandId: "stale-round",
      retryable: false,
      roundId: 1
    });

    const forbidden = { commandId: "participant-start", roundId: 1 };
    await expect(harness.commandError(participant, "start_quiz", forbidden)).resolves.toMatchObject({
      code: "ROLE_FORBIDDEN",
      commandId: "participant-start",
      retryable: false,
      roundId: 1
    });
  });

  it("replays the cached acknowledgement without applying a duplicate command ID twice", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");
    const command = { commandId: "same-command", roundId: 1 };
    const firstReceipt = participant.waitForMessage("command_accepted");
    participant.send("select_character", { ...command, characterId: "wizard", colorId: "violet" });
    const accepted = await firstReceipt;

    const replayReceipt = participant.waitForMessage("command_accepted");
    participant.send("select_character", { ...command, characterId: "knight", colorId: "gold" });

    await expect(replayReceipt).resolves.toEqual(accepted);
    expect([...harness.room.state.players.values()][0]).toMatchObject({ characterColorId: "violet", characterId: "wizard" });
  });

  it("rate-limits the sixth positioning attempt inside one second", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");
    const codes: string[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const error = await harness.commandError(participant, "localization_changed", {
        commandId: `position-attempt-${attempt}`,
        roundId: 1,
        state: "localized"
      });
      codes.push(error.code);
    }

    expect(codes).toEqual(["PHASE_MISMATCH", "PHASE_MISMATCH", "PHASE_MISMATCH", "PHASE_MISMATCH", "PHASE_MISMATCH", "RATE_LIMITED"]);
  });

  it("accepts 512 mutating commands in one round and rejects command 513", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");
    let acceptedCount = 0;
    participant.onMessage("command_accepted", () => { acceptedCount += 1; });
    const capped = participant.waitForMessage("server_error");

    for (let command = 0; command <= 512; command += 1) {
      participant.send("select_character", {
        characterId: "knight",
        colorId: "gold",
        commandId: `round-cap-${command}`,
        roundId: 1
      });
    }

    await expect(capped).resolves.toMatchObject({ code: "RATE_LIMITED", commandId: "round-cap-512", retryable: true });
    expect(acceptedCount).toBe(512);
  }, 10_000);

  it("rejects invalid, duplicate, and exact-deadline Quiz Run answers with stable codes", async () => {
    let now = 1_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const participant = await harness.joinParticipant("Ada");
      await harness.sendAndPatch(harness.organizer, "start_quiz", harness.command());
      const question = PROGRAMMING_FUNDAMENTALS_V1.questions[0]!;

      await expect(harness.commandError(participant, "quiz_answer", {
        ...harness.command("wrong-question"),
        optionId: question.answerOptionId,
        questionId: "another-question"
      })).resolves.toMatchObject({ code: "QUESTION_MISMATCH" });
      await expect(harness.commandError(participant, "quiz_answer", {
        ...harness.command("wrong-option"),
        optionId: "not-an-option",
        questionId: question.id
      })).resolves.toMatchObject({ code: "ANSWER_OPTION_INVALID" });

      const accepted = participant.waitForMessage("quiz_answer_accepted");
      participant.send("quiz_answer", { ...harness.command("accepted"), optionId: question.answerOptionId, questionId: question.id });
      await expect(accepted).resolves.toMatchObject({ questionId: question.id });
      await expect(harness.commandError(participant, "quiz_answer", {
        ...harness.command("semantic-duplicate"),
        optionId: question.answerOptionId,
        questionId: question.id
      })).resolves.toMatchObject({ code: "ANSWER_DUPLICATE" });

      now = harness.room.state.quiz.questionEndsAt;
      await expect(harness.commandError(participant, "quiz_answer", {
        ...harness.command("at-deadline"),
        optionId: question.answerOptionId,
        questionId: question.id
      })).resolves.toMatchObject({ code: "ANSWER_LATE" });
      expect(harness.room.state.quiz.submittedCount).toBe(1);
    } finally {
      restoreDependencies();
    }
  });

  it("publishes running Quiz Run results only to the answering participant", async () => {
    let now = 2_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const participant = await harness.joinParticipant("Ada");
      await harness.joinParticipant("Grace");
      await harness.sendAndPatch(harness.organizer, "start_quiz", harness.command());
      const question = PROGRAMMING_FUNDAMENTALS_V1.questions[0]!;
      const privateResult = participant.waitForMessage("quiz_answer_result");
      const organizerResults: unknown[] = [];
      harness.organizer.onMessage("quiz_answer_result", (result) => organizerResults.push(result));
      participant.send("quiz_answer", { ...harness.command(), optionId: question.answerOptionId, questionId: question.id });
      await harness.waitForPatch();

      now = harness.room.state.quiz.questionEndsAt;
      await harness.waitForPatch();

      await expect(privateResult).resolves.toMatchObject({ correct: true, questionId: question.id, runningCorrectAnswers: 1 });
      expect([...harness.room.state.players.values()].map((player) => player.correctAnswers)).toEqual([0, 0]);
      expect(organizerResults).toEqual([]);

      const token = await harness.disconnectUnexpectedly(participant);
      const resumed = await harness.reconnect(token);
      expect([...resumed.state.players.values()].map((player) => player.correctAnswers)).toEqual([0, 0]);
    } finally {
      restoreDependencies();
    }
  });

  it("accepts exact arena-radius endpoints and rejects values outside 3 to 6 meters", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    await expect(harness.commandError(harness.organizer, "configure_arena", { ...harness.command(), radiusM: 2.999 })).resolves.toMatchObject({
      code: "ARENA_RADIUS_INVALID"
    });

    await harness.sendAndPatch(harness.organizer, "configure_arena", { ...harness.command(), radiusM: 3 });
    expect(harness.room.state.arena.radiusM).toBe(3);
    await harness.sendAndPatch(harness.organizer, "configure_arena", { ...harness.command(), radiusM: 6 });
    expect(harness.room.state.arena.radiusM).toBe(6);
    await expect(harness.commandError(harness.organizer, "configure_arena", { ...harness.command(), radiusM: 6.001 })).resolves.toMatchObject({
      code: "ARENA_RADIUS_INVALID"
    });
  });

  it("returns finite position corrections and supports unlock followed by relock", async () => {
    let now = 3_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const first = await harness.joinParticipant("Ada");
      const second = await harness.joinParticipant("Grace");
      await harness.completeQuiz((value) => { now = value; });
      await harness.sendAndPatch(first, "localization_changed", { ...harness.command(), state: "localized" });
      await harness.sendAndPatch(second, "localization_changed", { ...harness.command(), state: "localized" });
      expect(harness.room.state.phase).toBe("positioning");

      const marker = await harness.commandError(first, "lock_position", { ...harness.command(), x: 0.749, z: 0 });
      expect(marker).toMatchObject({ code: "POSITION_IN_MARKER_EXCLUSION", details: { correction: { x: expect.any(Number), z: expect.any(Number) }, distanceM: expect.any(Number) } });
      const outside = await harness.commandError(first, "lock_position", { ...harness.command(), x: 4.001, z: 0 });
      expect(outside).toMatchObject({ code: "POSITION_OUT_OF_BOUNDS", details: { correction: { x: expect.any(Number), z: expect.any(Number) }, distanceM: expect.any(Number) } });
      await harness.sendAndPatch(first, "lock_position", { ...harness.command(), x: 0.75, z: 0 });

      const firstPlayerId = [...harness.room.state.players.keys()][0]!;
      const spacing = await harness.commandError(second, "lock_position", { ...harness.command(), x: 2.249, z: 0 });
      expect(spacing).toMatchObject({
        code: "SPACING_VIOLATION",
        details: {
          conflictsWithPlayerId: firstPlayerId,
          correction: { x: expect.any(Number), z: expect.any(Number) },
          distanceM: expect.any(Number)
        }
      });
      const correction = spacing.details?.correction as { readonly x: number; readonly z: number };
      expect([correction.x, correction.z, spacing.details?.distanceM].every((value) => typeof value === "number" && Number.isFinite(value))).toBe(true);
      await harness.sendAndPatch(second, "lock_position", { ...harness.command(), x: 2.25, z: 0 });

      await harness.sendAndPatch(first, "ready_changed", { ...harness.command(), ready: true });
      now += 1_001;
      await harness.sendAndPatch(first, "unlock_position", harness.command());
      expect(harness.room.state.players.get(firstPlayerId)).toMatchObject({ positionLocked: false, positionX: 0, positionZ: 0, ready: false });
      await harness.sendAndPatch(first, "lock_position", { ...harness.command(), x: -1, z: 0 });
      expect(harness.room.state.players.get(firstPlayerId)).toMatchObject({ positionLocked: true, positionX: -1, positionZ: 0 });
    } finally {
      restoreDependencies();
    }
  });

  it("returns every battle-start blocker and omits quiz-only participants", async () => {
    let now = 4_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const first = await harness.joinParticipant("Ada");
      const second = await harness.joinParticipant("Grace");
      await harness.joinParticipant("Quiz Only");
      const [firstPlayerId, secondPlayerId, quizOnlyPlayerId] = [...harness.room.state.players.keys()];
      await harness.sendAndPatch(harness.organizer, "set_combat_included", {
        ...harness.command(),
        included: false,
        playerId: quizOnlyPlayerId
      });
      await harness.completeQuiz((value) => { now = value; });
      await harness.sendAndPatch(first, "localization_changed", { ...harness.command(), state: "localized" });
      await harness.sendAndPatch(second, "localization_changed", { ...harness.command(), state: "localized" });
      await harness.sendAndPatch(first, "lock_position", { ...harness.command(), x: 1, z: 0 });
      await harness.sendAndPatch(first, "ready_changed", { ...harness.command(), ready: true });
      await harness.sendAndPatch(first, "localization_changed", { ...harness.command(), state: "lost" });
      await harness.disconnectUnexpectedly(second);

      const blocked = await harness.commandError(harness.organizer, "start_battle", harness.command());

      expect(blocked).toMatchObject({ code: "BATTLE_START_BLOCKED", retryable: true });
      expect(blocked.details?.blockers).toEqual([
        { playerId: firstPlayerId, reason: "NOT_LOCALIZED" },
        { playerId: firstPlayerId, reason: "NOT_READY" },
        { playerId: secondPlayerId, reason: "DISCONNECTED" },
        { playerId: secondPlayerId, reason: "POSITION_UNLOCKED" },
        { playerId: secondPlayerId, reason: "NOT_READY" }
      ]);
      expect(JSON.stringify(blocked.details)).not.toContain(quizOnlyPlayerId);
    } finally {
      restoreDependencies();
    }
  });

  it("rejects an unsupported battle weapon with WEAPON_INVALID", async () => {
    let now = 5_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const first = await harness.joinParticipant("Ada");
      const second = await harness.joinParticipant("Grace");
      await harness.advanceToBattle([first, second], [{ x: 1, z: 0 }, { x: -1, z: 0 }], (value) => { now = value; });
      const metadata = harness.command("invalid-weapon");

      await expect(harness.commandError(first, "attack", {
        ...metadata,
        dirX: -1,
        dirZ: 0,
        weaponId: "fireball"
      })).resolves.toMatchObject({ code: "WEAPON_INVALID" });
    } finally {
      restoreDependencies();
    }
  });

  it("rejects invalid combat states while preserving ordered miss, hit, elimination, and completion events", async () => {
    let now = 6_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const first = await harness.joinParticipant("Ada");
      const second = await harness.joinParticipant("Grace");
      const third = await harness.joinParticipant("Linus");
      await expect(harness.commandError(first, "attack", {
        ...harness.command("before-battle"),
        dirX: 1,
        dirZ: 0,
        weaponId: "bolt"
      })).resolves.toMatchObject({ code: "ATTACK_NOT_ALLOWED" });

      await harness.advanceToBattle(
        [first, second, third],
        [{ x: -2, z: 0 }, { x: 1, z: 0 }, { x: 2.5, z: 0 }],
        (value) => { now = value; }
      );
      const [firstPlayerId, secondPlayerId] = [...harness.room.state.players.keys()];
      const orderedEvents: Array<{ readonly eventSequence: number; readonly type: string }> = [];
      harness.organizer.onMessage("attack_resolved", (event) => orderedEvents.push({ eventSequence: event.eventSequence, type: "attack_resolved" }));
      harness.organizer.onMessage("player_eliminated", (event) => orderedEvents.push({ eventSequence: event.eventSequence, type: "player_eliminated" }));
      harness.organizer.onMessage("battle_completed", (event) => orderedEvents.push({ eventSequence: event.eventSequence, type: "battle_completed" }));

      await expect(harness.commandError(first, "attack", {
        ...harness.command("bad-direction"),
        dirX: 0,
        dirZ: 0,
        weaponId: "bolt"
      })).resolves.toMatchObject({ code: "ATTACK_DIRECTION_INVALID" });
      await harness.sendAndPatch(first, "localization_changed", { ...harness.command(), state: "lost" });
      await expect(harness.commandError(first, "attack", {
        ...harness.command("tracking-lost"),
        dirX: 1,
        dirZ: 0,
        weaponId: "bolt"
      })).resolves.toMatchObject({ code: "ATTACK_NOT_ALLOWED" });
      await harness.sendAndPatch(first, "localization_changed", { ...harness.command(), state: "localized" });

      await harness.sendAndPatch(first, "attack", { ...harness.command("miss"), dirX: -1, dirZ: 0, weaponId: "bolt" });
      expect(orderedEvents.at(-1)).toMatchObject({ type: "attack_resolved" });
      await expect(harness.commandError(first, "attack", {
        ...harness.command("cooldown"),
        dirX: 1,
        dirZ: 0,
        weaponId: "bolt"
      })).resolves.toMatchObject({ code: "ATTACK_COOLDOWN" });

      now = harness.room.state.players.get(firstPlayerId!)!.nextAttackAt;
      await harness.sendAndPatch(first, "attack", { ...harness.command("hit"), dirX: 1, dirZ: 0, weaponId: "bolt" });
      expect(harness.room.state.players.get(secondPlayerId!)?.hp).toBe(90);

      for (let hit = 0; hit < 10; hit += 1) {
        now = Math.max(now, harness.room.state.players.get(secondPlayerId!)!.nextAttackAt);
        await harness.sendAndPatch(second, "attack", { ...harness.command(`eliminate-${hit}`), dirX: -1, dirZ: 0, weaponId: "bolt" });
      }
      expect(harness.room.state.phase).toBe("battle");
      expect(harness.room.state.players.get(firstPlayerId!)).toMatchObject({ eliminated: true, hp: 0 });
      await expect(harness.commandError(first, "attack", {
        ...harness.command("eliminated-attacker"),
        dirX: 1,
        dirZ: 0,
        weaponId: "bolt"
      })).resolves.toMatchObject({ code: "ATTACK_NOT_ALLOWED" });

      now = harness.room.state.battle.endsAt;
      await harness.waitForPatch();
      expect(harness.room.state.phase).toBe("results");
      await expect(harness.commandError(second, "attack", {
        ...harness.command("after-battle"),
        dirX: 1,
        dirZ: 0,
        weaponId: "bolt"
      })).resolves.toMatchObject({ code: "ATTACK_NOT_ALLOWED" });
      expect(orderedEvents.map((event) => event.eventSequence)).toEqual([...orderedEvents.map((event) => event.eventSequence)].sort((left, right) => left - right));
      expect(orderedEvents.at(-1)).toMatchObject({ type: "battle_completed" });
    } finally {
      restoreDependencies();
    }
  }, 10_000);

  it("resets every round-scoped field, prunes departed participants, and rejects old-round commands", async () => {
    let now = 7_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const first = await harness.joinParticipant("Ada");
      const second = await harness.joinParticipant("Grace");
      const firstPlayerId = [...harness.room.state.players.keys()][0]!;
      const reusedCommandId = "reused-after-reset";
      await harness.sendAndPatch(first, "select_character", {
        characterId: "wizard",
        colorId: "violet",
        commandId: reusedCommandId,
        roundId: 1
      });
      await harness.sendAndPatch(harness.organizer, "start_quiz", harness.command());
      for (const [index, question] of PROGRAMMING_FUNDAMENTALS_V1.questions.entries()) {
        if (index === PROGRAMMING_FUNDAMENTALS_V1.questions.length - 1) {
          const accepted = first.waitForMessage("quiz_answer_accepted");
          first.send("quiz_answer", { ...harness.command(), optionId: question.answerOptionId, questionId: question.id });
          await accepted;
        }
        now = harness.room.state.quiz.questionEndsAt;
        await harness.waitForPatch();
        now = harness.room.state.quiz.revealEndsAt;
        await harness.waitForPatch();
      }
      await harness.advanceFromLocalizationToBattle(
        [first, second],
        [{ x: 1, z: 0 }, { x: -1, z: 0 }],
        (value) => { now = value; }
      );
      await second.leave();
      await harness.waitForPatch();
      expect(harness.room.state.phase).toBe("results");

      await harness.sendAndPatch(harness.organizer, "reset_round", harness.command("reset"));

      expect(harness.room.state).toMatchObject({ eventSequence: 0, phase: "lobby", roundId: 2 });
      expect(harness.room.state.players.size).toBe(1);
      expect(harness.room.state.players.get(firstPlayerId)).toMatchObject({
        characterColorId: "gold",
        characterId: "default",
        charges: -1,
        combatIncluded: true,
        correctAnswers: 0,
        eliminated: false,
        hasAnsweredCurrent: false,
        hp: 100,
        localization: "not_started",
        nextAttackAt: 0,
        positionLocked: false,
        positionX: 0,
        positionZ: 0,
        quizCompleted: false,
        ready: false,
        shield: 0
      });
      expect(harness.room.state.battle).toMatchObject({ completionReason: "", endsAt: 0, startsAt: 0, status: "not_started", winnerId: "" });
      expect(harness.room.state.quiz).toMatchObject({ questionIndex: -1, status: "ready", submittedCount: 0 });

      const replayed = first.waitForMessage("command_accepted");
      first.send("select_character", { characterId: "knight", colorId: "aqua", commandId: reusedCommandId, roundId: 2 });
      await expect(replayed).resolves.toMatchObject({ commandId: reusedCommandId, roundId: 2 });
      await expect(harness.commandError(first, "select_character", {
        characterId: "ninja",
        colorId: "coral",
        commandId: "old-round",
        roundId: 1
      })).resolves.toMatchObject({ code: "ROUND_MISMATCH", commandId: "old-round", roundId: 2 });
    } finally {
      restoreDependencies();
    }
  }, 10_000);
});
