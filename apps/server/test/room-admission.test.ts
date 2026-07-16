import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import { PROGRAMMING_FUNDAMENTALS_V1 } from "@codexwars/shared";
import appConfig, { createAppConfig } from "../src/app.config.js";
import { setWarRoomDependenciesForTest } from "../src/rooms/war-room.js";
import { WarRoomHarness } from "./support/war-room-harness.js";

let colyseus: ColyseusTestServer;
let rehearsalBaseline: string | undefined;

beforeAll(async () => {
  colyseus = await boot(appConfig);
});

afterAll(async () => {
  await colyseus.shutdown();
});

beforeEach(async () => {
  await colyseus.cleanup();
});

describe("War Room admission", () => {
  it("serves bounded operational HTTP responses from the Colyseus application", async () => {
    const health = await colyseus.http.get("/health");
    const ready = await colyseus.http.get("/ready");
    const port = (colyseus.server as unknown as { readonly port: number }).port;
    const unknown = await fetch(`http://127.0.0.1:${port}/does-not-exist`);

    expect(health).toMatchObject({ data: { protocolVersion: 1, service: "codexwars-server", status: "ok" }, statusCode: 200 });
    expect(ready).toMatchObject({ data: { protocolVersion: 1, service: "codexwars-server", status: "ready" }, statusCode: 200 });
    expect(unknown.status).toBe(404);
    await expect(unknown.json()).resolves.toEqual({ code: "NOT_FOUND", message: "Route not found" });
  });

  it("binds the creator as a separate organizer and normalizes a participant nickname", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    await harness.joinParticipant("  Ada\tLovelace  ");
    const { room } = harness;

    expect(room.roomId).toMatch(/^\d{4}$/);
    expect(room.state.organizer.displayName).toBe("Teacher");
    expect(room.state.organizer.connected).toBe(true);
    expect(room.state.players.size).toBe(1);
    expect([...room.state.players.values()][0]?.displayName).toBe("Ada Lovelace");
  });

  it("returns the server-bound role and player identity on request", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");
    const { organizer, room } = harness;
    const playerId = [...room.state.players.keys()][0]!;

    const organizerIdentity = organizer.waitForMessage("session_ready");
    organizer.send("request_session", { protocolVersion: 1 });
    const participantIdentity = participant.waitForMessage("session_ready");
    participant.send("request_session", { protocolVersion: 1 });

    await expect(organizerIdentity).resolves.toEqual({ playerId: null, role: "organizer" });
    await expect(participantIdentity).resolves.toEqual({ playerId, role: "participant" });
  });

  it("synchronizes an approved cosmetic selection without changing Battle Stats", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");
    const { room } = harness;
    const playerId = [...room.state.players.keys()][0]!;
    const before = room.state.players.get(playerId)!;
    const battleStats = {
      charges: before.charges,
      hp: before.hp,
      maxHp: before.maxHp,
      nextAttackAt: before.nextAttackAt,
      shield: before.shield,
      weaponId: before.weaponId
    };

    await harness.sendAndPatch(participant, "select_character", {
      characterId: "wizard",
      colorId: "violet",
      commandId: "select-wizard",
      roundId: room.state.roundId
    });

    expect(room.state.players.get(playerId)).toMatchObject({
      characterColorId: "violet",
      characterId: "wizard"
    });
    expect(room.state.players.get(playerId)).toMatchObject(battleStats);
  });

  it("removes an intentional participant leave instead of retaining a ghost record", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");

    await participant.leave();
    await harness.waitForPatch();

    expect(harness.room.state.players.size).toBe(0);
  });

  it("restores an unexpectedly disconnected participant with the same player record", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    const participant = await harness.joinParticipant("Ada");
    const { room } = harness;
    const playerId = [...room.state.players.keys()][0];

    const reconnectionToken = await harness.disconnectUnexpectedly(participant);
    expect(room.state.players.get(playerId)?.connected).toBe(false);

    const resumed = await harness.reconnect(reconnectionToken);

    expect(room.state.players.size).toBe(1);
    expect(room.state.players.get(playerId)?.connected).toBe(true);
    expect(resumed.state.players.get(playerId)?.displayName).toBe("Ada");
  });

  it("restores organizer authority without transferring it to participants", async () => {
    const harness = await WarRoomHarness.create(colyseus);
    await harness.joinParticipant("Ada");
    const { organizer, room } = harness;

    const reconnectionToken = await harness.disconnectUnexpectedly(organizer);
    expect(room.state.organizer.connected).toBe(false);

    const resumedOrganizer = await harness.reconnect(reconnectionToken);
    expect(room.state.organizer.connected).toBe(true);

    resumedOrganizer.send("start_quiz", { commandId: "organizer-resumed", roundId: room.state.roundId });
    await room.waitForNextPatch();
    expect(room.state.phase).toBe("quiz");
  });

  it("logs only redacted correlation metadata for rejected traffic", async () => {
    const logs: unknown[] = [];
    const restoreDependencies = setWarRoomDependenciesForTest({ log: (entry) => logs.push(entry) });
    try {
      const harness = await WarRoomHarness.create(colyseus, "Teacher Secret");
      const participant = await harness.joinParticipant("Ada Secret");

      await harness.sendAndPatch(participant, "attack", { commandId: "blocked-attack", dirX: 1, dirZ: 0, roundId: 1, weaponId: "bolt" });

      expect(logs).toEqual([{
        correlationId: "blocked-attack",
        errorCode: "ATTACK_NOT_ALLOWED",
        eventType: "server_error",
        playerId: "player-1",
        roomIdHash: expect.any(String)
      }]);
      expect(JSON.stringify(logs)).not.toContain("Secret");
    } finally {
      restoreDependencies();
    }
  });

  it.each([1, 2])("rehearses a deterministic twelve-participant room through reset without leaking quiz answers (run %i)", async (run) => {
    let now = 1_000_000;
    const startedAt = Date.now();
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const { room } = harness;
      let organizer: ClientRoom = harness.organizer;
      const participants: ClientRoom[] = [];
      for (let index = 0; index < 12; index += 1) {
        participants.push(await harness.joinParticipant(index < 2 ? "Ada" : `Player ${index + 1}`));
      }
      expect(room.state.players.size).toBe(12);
      expect([...room.state.players.values()][1]?.displayName).toBe("Ada (2)");

      const metadata = () => harness.command();
      const waitForPatch = async (): Promise<void> => harness.waitForPatch();

      for (const player of [...room.state.players.values()].slice(2)) {
        organizer.send("set_combat_included", { ...metadata(), included: false, playerId: player.playerId });
      }
      await waitForPatch();
      organizer.send("start_quiz", metadata());
      await waitForPatch();

      for (const [index, question] of PROGRAMMING_FUNDAMENTALS_V1.questions.entries()) {
        if (index === 0) {
          now = room.state.quiz.questionEndsAt - 1;
          for (const participant of participants.slice(2)) {
            participant.send("quiz_answer", { ...metadata(), optionId: "a", questionId: question.id });
          }
        }
        participants[0]?.send("quiz_answer", { ...metadata(), optionId: question.answerOptionId, questionId: question.id });
        if (index < 5) participants[1]?.send("quiz_answer", { ...metadata(), optionId: question.answerOptionId, questionId: question.id });
        await waitForPatch();
        if (index === 0) expect(room.state.quiz.submittedCount).toBe(12);
        expect(JSON.stringify(room.state)).not.toContain("answerOptionId");
        now = room.state.quiz.questionEndsAt;
        await waitForPatch();
        now = room.state.quiz.revealEndsAt;
        await waitForPatch();
      }

      expect(room.state.phase).toBe("localization");
      participants[0]?.send("localization_changed", { ...metadata(), state: "localized" });
      participants[1]?.send("localization_changed", { ...metadata(), state: "localized" });
      await waitForPatch();
      expect(room.state.phase).toBe("positioning");

      participants[0]?.send("lock_position", { ...metadata(), x: 1, z: 0 });
      participants[1]?.send("lock_position", { ...metadata(), x: -1, z: 0 });
      await waitForPatch();
      participants[0]?.send("ready_changed", { ...metadata(), ready: true });
      participants[1]?.send("ready_changed", { ...metadata(), ready: true });
      await waitForPatch();
      organizer.send("start_battle", metadata());
      await waitForPatch();
      now = room.state.battle.startsAt;
      await waitForPatch();
      expect(room.state.phase).toBe("battle");

      const secondPlayerId = [...room.state.players.values()][1]?.playerId;
      const secondPlayerBeforeDrop = room.state.players.get(secondPlayerId ?? "");
      const secondParticipant = participants[1]!;
      const participantReconnectionToken = await harness.disconnectUnexpectedly(secondParticipant);
      expect(room.state.players.get(secondPlayerId ?? "")?.connected).toBe(false);
      expect(room.state.players.get(secondPlayerId ?? "")?.hp).toBe(secondPlayerBeforeDrop?.hp);
      participants[1] = await harness.reconnect(participantReconnectionToken);
      expect(room.state.players.get(secondPlayerId ?? "")?.connected).toBe(true);
      expect(room.state.players.get(secondPlayerId ?? "")?.positionLocked).toBe(true);

      const battleEndsAt = room.state.battle.endsAt;
      const organizerReconnectionToken = await harness.disconnectUnexpectedly(organizer);
      expect(room.state.organizer.connected).toBe(false);
      organizer = await harness.reconnect(organizerReconnectionToken);
      expect(room.state.organizer.connected).toBe(true);
      expect(room.state.battle.endsAt).toBe(battleEndsAt);

      let firstBurstAttack: { readonly commandId: string; readonly dirX: number; readonly dirZ: number; readonly roundId: number; readonly weaponId: "bolt" } | undefined;
      for (let burst = 0; burst < 10; burst += 1) {
        const attack = { ...metadata(), dirX: -1, dirZ: 0, weaponId: "bolt" as const };
        if (burst === 0) firstBurstAttack = attack;
        participants[0]?.send("attack", attack);
      }
      await waitForPatch();
      expect([...room.state.players.values()][1]?.shield).toBe(10);
      const duplicateOutcome = participants[0]!.waitForMessage("command_accepted");
      participants[0]!.send("attack", firstBurstAttack!);
      await expect(duplicateOutcome).resolves.toMatchObject({ command: "attack", commandId: firstBurstAttack!.commandId });

      for (let hit = 0; hit < 11; hit += 1) {
        now = Math.max(now, [...room.state.players.values()][0]?.nextAttackAt ?? now);
        participants[0]?.send("attack", { ...metadata(), dirX: -1, dirZ: 0, weaponId: "bolt" });
        await waitForPatch();
      }

      expect(room.state.phase).toBe("results");
      expect(room.state.battle.winnerId).toBe([...room.state.players.values()][0]?.playerId);
      const resultSignature = JSON.stringify({
        standings: [...room.state.battle.standings].map((standing) => ({ eliminated: standing.eliminated, hp: standing.hp, playerId: standing.playerId, rank: standing.rank, shield: standing.shield })),
        winnerId: room.state.battle.winnerId
      });
      if (rehearsalBaseline === undefined) rehearsalBaseline = resultSignature;
      else expect(resultSignature).toBe(rehearsalBaseline);
      const completedEventCount = room.state.eventSequence;
      organizer.send("reset_round", metadata());
      await waitForPatch();
      expect(room.state.phase).toBe("lobby");
      expect(room.state.roundId).toBe(2);
      expect(room.state.eventSequence).toBe(0);
      console.info(JSON.stringify({
        commandCount: harness.commandCount,
        durationMs: Date.now() - startedAt,
        eventCount: completedEventCount,
        failures: 0,
        participantCount: 12,
        run,
        scenario: "p0-m1-rehearsal"
      }));
    } finally {
      restoreDependencies();
    }
  }, 20_000);

  it("ends pre-restart sessions and accepts a new room after a fresh server boot", async () => {
    const firstConfig = createAppConfig();
    await firstConfig.listen(2661);
    const firstServer = new ColyseusTestServer(firstConfig);
    let firstServerStopped = false;
    let secondServer: ColyseusTestServer | undefined;
    try {
      const oldRoom = await firstServer.createRoom("war", { displayName: "Teacher", protocolVersion: 1 });
      const oldParticipant = await firstServer.connectTo(oldRoom, { displayName: "Ada", protocolVersion: 1 });
      const oldToken = oldParticipant.reconnectionToken;
      await firstServer.shutdown();
      firstServerStopped = true;

      await expect(firstServer.sdk.reconnect(oldToken)).rejects.toBeDefined();

      const secondConfig = createAppConfig();
      await secondConfig.listen(2662);
      secondServer = new ColyseusTestServer(secondConfig);
      expect((await secondServer.http.get("/health")).statusCode).toBe(200);
      expect((await secondServer.http.get("/ready")).statusCode).toBe(200);
      const newRoom = await secondServer.createRoom("war", { displayName: "Teacher", protocolVersion: 1 });
      await expect(secondServer.connectTo(newRoom, { displayName: "Ada", protocolVersion: 1 })).resolves.toBeDefined();
    } finally {
      await secondServer?.shutdown();
      if (!firstServerStopped) await firstServer.shutdown();
    }
  });
});
