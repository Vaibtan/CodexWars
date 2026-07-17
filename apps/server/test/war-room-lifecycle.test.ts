import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { setWarRoomDependenciesForTest } from "../src/rooms/war-room.js";
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

describe("War Room lifecycle", () => {
  it("excludes a participant after pre-battle reconnect expiry without deadlocking phase progression", async () => {
    let now = 10_000;
    const restoreDependencies = setWarRoomDependenciesForTest({
      log: () => undefined,
      now: () => now,
      reconnectGraceMs: () => 0
    });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const participant = await harness.joinParticipant("Ada");
      const playerId = [...harness.room.state.players.keys()][0]!;
      const eliminatedEvents: unknown[] = [];
      harness.organizer.onMessage("player_eliminated", (event) => eliminatedEvents.push(event));
      await harness.prepareQuiz();
      await harness.sendAndPatch(harness.organizer, "start_quiz", harness.command());

      await harness.disconnectUnexpectedly(participant);

      expect(harness.room.state.players.get(playerId)).toMatchObject({
        combatIncluded: false,
        connected: false,
        eliminated: false,
        hp: 100,
        positionLocked: false,
        ready: false
      });
      expect(eliminatedEvents).toEqual([]);

      await harness.finishQuiz((value) => { now = value; });
      expect(harness.room.state.phase).toBe("positioning");
      expect(harness.room.state.players.get(playerId)).toMatchObject({ correctAnswers: 0, quizCompleted: true });
    } finally {
      restoreDependencies();
    }
  });

  it("eliminates a participant exactly once when active-round reconnect grace expires", async () => {
    let now = 20_000;
    const restoreDependencies = setWarRoomDependenciesForTest({
      log: () => undefined,
      now: () => now,
      reconnectGraceMs: () => 0
    });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const first = await harness.joinParticipant("Ada");
      const second = await harness.joinParticipant("Grace");
      const third = await harness.joinParticipant("Linus");
      await harness.advanceToBattle(
        [first, second, third],
        [{ x: -2, z: 0 }, { x: 1, z: 0 }, { x: 2.5, z: 0 }],
        (value) => { now = value; }
      );
      const departingPlayerId = [...harness.room.state.players.keys()][1]!;
      const eliminatedEvents: unknown[] = [];
      harness.organizer.onMessage("player_eliminated", (event) => eliminatedEvents.push(event));
      const eventsBeforeDrop = harness.room.state.eventSequence;

      await harness.disconnectUnexpectedly(second);
      await harness.waitForPatch();

      expect(harness.room.state.players.get(departingPlayerId)).toMatchObject({ connected: false, eliminated: true, hp: 0 });
      expect(harness.room.state.phase).toBe("battle");
      expect(eliminatedEvents).toEqual([expect.objectContaining({ eliminatedByPlayerId: null, playerId: departingPlayerId })]);
      expect(harness.room.state.eventSequence).toBe(eventsBeforeDrop + 1);
    } finally {
      restoreDependencies();
    }
  });

  it("closes the War Room when the organizer's 60-second pre-battle grace expires", async () => {
    const configuredGrace: number[] = [];
    const restoreDependencies = setWarRoomDependenciesForTest({
      log: () => undefined,
      reconnectGraceMs: (graceMs) => {
        configuredGrace.push(graceMs);
        return 0;
      }
    });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const roomId = harness.room.roomId;
      harness.organizer.reconnection.enabled = false;
      harness.organizer.connection.close();
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(configuredGrace).toEqual([60_000]);
      await expect(colyseus.sdk.joinById(roomId, { displayName: "Ada", protocolVersion: 2 })).rejects.toThrow(/not found|disposed/iu);
    } finally {
      restoreDependencies();
    }
  });

  it("keeps an active battle running after the organizer's 20-second grace expires", async () => {
    let now = 30_000;
    const configuredGrace: number[] = [];
    const restoreDependencies = setWarRoomDependenciesForTest({
      log: () => undefined,
      now: () => now,
      reconnectGraceMs: (graceMs) => {
        configuredGrace.push(graceMs);
        return 0;
      }
    });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const first = await harness.joinParticipant("Ada");
      const second = await harness.joinParticipant("Grace");
      await harness.advanceToBattle([first, second], [{ x: 1, z: 0 }, { x: -1, z: 0 }], (value) => { now = value; });
      const endsAt = harness.room.state.battle.endsAt;
      const eventsBeforeDrop = harness.room.state.eventSequence;

      await harness.disconnectUnexpectedly(harness.organizer);
      await harness.sendAndPatch(first, "attack", { ...harness.command(), dirX: 1, dirZ: 0, weaponId: "bolt" });

      expect(configuredGrace).toContain(20_000);
      expect(harness.room.state.organizer.connected).toBe(false);
      expect(harness.room.state.phase).toBe("battle");
      expect(harness.room.state.battle.endsAt).toBe(endsAt);
      expect(harness.room.state.eventSequence).toBe(eventsBeforeDrop + 1);
    } finally {
      restoreDependencies();
    }
  });

  it("expires a War Room at exactly two hours without successful activity", async () => {
    let now = 40_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const roomId = harness.room.roomId;
      now += 7_200_000 - 1;
      await harness.waitForPatch();
      expect(harness.room.state.serverNow).toBe(now);

      now += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));

      await expect(colyseus.sdk.joinById(roomId, { displayName: "Ada", protocolVersion: 2 })).rejects.toThrow(/not found|disposed/iu);
    } finally {
      restoreDependencies();
    }
  });
});
