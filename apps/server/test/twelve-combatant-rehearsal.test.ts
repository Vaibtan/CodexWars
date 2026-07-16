import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import appConfig from "../src/app.config.js";
import { setWarRoomDependenciesForTest } from "../src/rooms/war-room.js";
import { WarRoomHarness } from "./support/war-room-harness.js";

const PARTICIPANT_COUNT = 12;
const RAW_ATTACKS_PER_PARTICIPANT = 10;
const POSITION_RADIUS_M = 3.9;

let colyseus: ColyseusTestServer;
let deterministicResult: string | undefined;

beforeAll(async () => {
  colyseus = await boot(appConfig);
});

afterAll(async () => {
  await colyseus.shutdown();
});

beforeEach(async () => {
  await colyseus.cleanup();
});

function ringPositions(): readonly { readonly x: number; readonly z: number }[] {
  return Array.from({ length: PARTICIPANT_COUNT }, (_, index) => {
    const angle = index * Math.PI * 2 / PARTICIPANT_COUNT;
    return { x: POSITION_RADIUS_M * Math.cos(angle), z: POSITION_RADIUS_M * Math.sin(angle) };
  });
}

describe("twelve-combatant backend rehearsal", () => {
  it.each([1, 2])("completes a deterministic maximum-rate battle run %i", async (run) => {
    let now = 50_000;
    const restoreDependencies = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      const participants: ClientRoom[] = [];
      for (let index = 0; index < PARTICIPANT_COUNT; index += 1) {
        participants.push(await harness.joinParticipant(`Participant ${index + 1}`));
      }
      for (const client of [harness.organizer, ...participants]) {
        for (const type of ["attack_resolved", "battle_completed", "battle_countdown_started", "command_accepted", "quiz_answer_result", "quiz_completed", "quiz_question_revealed", "quiz_question_started"]) {
          client.onMessage(type, () => undefined);
        }
      }
      const positions = ringPositions();
      for (const [index, position] of positions.entries()) {
        expect(Math.hypot(position.x, position.z)).toBeCloseTo(POSITION_RADIUS_M, 10);
        const next = positions[(index + 1) % positions.length]!;
        expect(Math.hypot(position.x - next.x, position.z - next.z)).toBeGreaterThan(1.5);
      }

      await harness.advanceToBattle(participants, positions, (value) => { now = value; });
      expect(harness.room.patchRate).toBe(100);
      expect(harness.room.state.phase).toBe("battle");
      expect([...harness.room.state.players.values()].every((player) => player.combatIncluded && player.positionLocked && player.ready)).toBe(true);

      const acceptedCounts = Array.from({ length: PARTICIPANT_COUNT }, () => 0);
      const errorCodes = Array.from({ length: PARTICIPANT_COUNT }, () => [] as string[]);
      const attackEvents: Array<{ readonly commandId: string; readonly eventSequence: number }> = [];
      participants.forEach((participant, index) => {
        participant.onMessage("command_accepted", () => { acceptedCounts[index] += 1; });
        participant.onMessage("server_error", (error) => { errorCodes[index]!.push(error.code); });
      });
      harness.organizer.onMessage("attack_resolved", (event) => attackEvents.push({ commandId: event.commandId, eventSequence: event.eventSequence }));

      let firstAttack: { readonly commandId: string; readonly dirX: number; readonly dirZ: number; readonly roundId: number; readonly weaponId: "bolt" } | undefined;
      for (const [index, participant] of participants.entries()) {
        const position = positions[index]!;
        for (let attempt = 0; attempt < RAW_ATTACKS_PER_PARTICIPANT; attempt += 1) {
          const attack = {
            ...harness.command(`attack-${index}-${attempt}`),
            dirX: -position.x / POSITION_RADIUS_M,
            dirZ: -position.z / POSITION_RADIUS_M,
            weaponId: "bolt" as const
          };
          if (index === 0 && attempt === 0) firstAttack = attack;
          participant.send("attack", attack);
        }
      }
      await vi.waitFor(() => {
        expect(acceptedCounts.reduce((total, count) => total + count, 0)).toBe(PARTICIPANT_COUNT);
        expect(errorCodes.flat()).toHaveLength(PARTICIPANT_COUNT * (RAW_ATTACKS_PER_PARTICIPANT - 1));
      });
      expect(errorCodes.flat().every((code) => code === "ATTACK_COOLDOWN")).toBe(true);
      expect(attackEvents).toHaveLength(PARTICIPANT_COUNT);
      expect(attackEvents.map((event) => event.eventSequence)).toEqual([...attackEvents.map((event) => event.eventSequence)].sort((left, right) => left - right));

      for (const [index, participant] of participants.entries()) {
        const position = positions[index]!;
        participant.send("attack", {
          ...harness.command(`over-limit-${index}`),
          dirX: -position.x / POSITION_RADIUS_M,
          dirZ: -position.z / POSITION_RADIUS_M,
          weaponId: "bolt"
        });
      }
      await vi.waitFor(() => expect(errorCodes.flat()).toHaveLength(PARTICIPANT_COUNT * RAW_ATTACKS_PER_PARTICIPANT));
      expect(errorCodes.every((codes) => codes.at(-1) === "RATE_LIMITED")).toBe(true);

      const hpBeforeReplay = [...harness.room.state.players.values()].map((player) => player.hp);
      participants[0]!.send("attack", firstAttack!);
      await vi.waitFor(() => expect(acceptedCounts[0]).toBe(2));
      await harness.waitForPatch();
      expect([...harness.room.state.players.values()].map((player) => player.hp)).toEqual(hpBeforeReplay);
      expect(attackEvents).toHaveLength(PARTICIPANT_COUNT);

      now = harness.room.state.battle.endsAt;
      await harness.waitForPatch();
      expect(harness.room.state).toMatchObject({ eventSequence: 34, phase: "results" });
      expect(harness.room.state.battle).toMatchObject({ completionReason: "timer", status: "completed" });
      expect(harness.room.state.battle.standings).toHaveLength(PARTICIPANT_COUNT);

      const result = JSON.stringify({
        standings: [...harness.room.state.battle.standings].map((standing) => ({ hp: standing.hp, playerId: standing.playerId, rank: standing.rank })),
        winnerId: harness.room.state.battle.winnerId
      });
      if (deterministicResult === undefined) deterministicResult = result;
      else expect(result).toBe(deterministicResult);
    } finally {
      restoreDependencies();
    }
  }, 15_000);
});
