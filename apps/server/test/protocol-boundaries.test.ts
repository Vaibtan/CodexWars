import { describe, expect, it } from "vitest";
import { isClientEventPayload, isPublicRoomStateProjection, isServerEventPayload, isSessionRequestPayload, normalizeDirection, parseCommand } from "@codexwars/shared";
import { WarRoomState } from "../src/rooms/state.js";

describe("shared protocol boundaries", () => {
  it("accepts only approved cosmetic selections with an exact payload", () => {
    expect(parseCommand("select_character", {
      characterId: "knight",
      colorId: "gold",
      commandId: "character-1",
      roundId: 1
    })).toEqual({
      ok: true,
      value: {
        characterId: "knight",
        colorId: "gold",
        command: "select_character",
        commandId: "character-1",
        roundId: 1
      }
    });

    expect(parseCommand("select_character", {
      characterId: "dragon",
      colorId: "gold",
      commandId: "character-2",
      roundId: 1
    })).toEqual({ code: "POSITION_INVALID", ok: false });

    expect(parseCommand("select_character", {
      characterId: "knight",
      colorId: "gold",
      commandId: "character-3",
      hitRadiusM: 9,
      roundId: 1
    })).toEqual({ code: "POSITION_INVALID", ok: false });
  });

  it("rejects oversize and authority-shaped command payloads before gameplay", () => {
    expect(parseCommand("attack", {
      commandId: "attack-1",
      dirX: 1,
      dirZ: 0,
      extraAuthority: "organizer",
      roundId: 1,
      weaponId: "bolt"
    })).toEqual({ code: "POSITION_INVALID", ok: false });

    expect(parseCommand("attack", {
      commandId: "attack-2",
      dirX: 1,
      dirZ: 0,
      padding: "x".repeat(3_000),
      roundId: 1,
      weaponId: "bolt"
    })).toEqual({ code: "RATE_LIMITED", ok: false });
  });

  it("normalizes only finite P0 aim vectors in the allowed range", () => {
    expect(normalizeDirection(2, 0)).toEqual({ direction: { x: 1, z: 0 }, ok: true });
    expect(normalizeDirection(0.09, 0)).toEqual({ ok: false });
    expect(normalizeDirection(2.01, 0)).toEqual({ ok: false });
  });

  it("accepts the exact public Schema projection and rejects leaked private fields", () => {
    const projection = new WarRoomState().toJSON() as Record<string, unknown>;
    expect(isPublicRoomStateProjection(projection)).toBe(true);

    const leaked = structuredClone(projection) as { quiz: { currentQuestion: Record<string, unknown> } };
    leaked.quiz.currentQuestion.answerOptionId = "private-answer";
    expect(isPublicRoomStateProjection(leaked)).toBe(false);
  });

  it("allows only exact server and client event payloads", () => {
    expect(isClientEventPayload("command_accepted", {
      command: "start_quiz",
      commandId: "start-1",
      roundId: 1,
      serverNow: 1_000
    })).toBe(true);
    expect(isClientEventPayload("command_accepted", {
      command: "start_quiz",
      commandId: "start-1",
      serverNow: 1_000
    })).toBe(false);
    expect(isServerEventPayload("attack_resolved", {
      attackerId: "player-1",
      commandId: "attack-1",
      damage: 10,
      targetHp: 90,
      targetId: "player-2",
      targetShield: 0
    })).toBe(true);
    expect(isServerEventPayload("attack_resolved", {
      attackerId: "player-1",
      commandId: "attack-1",
      damage: 10,
      targetHp: 90,
      targetId: "player-2",
      targetShield: 0,
      token: "must-not-leak"
    })).toBe(false);
    expect(isClientEventPayload("quiz_answer_result", {
      correct: true,
      questionId: "q1",
      roundId: 1,
      runningCorrectAnswers: 1,
      selectedOptionId: "a"
    })).toBe(true);
    expect(isClientEventPayload("quiz_answer_result", {
      correct: true,
      questionId: "q1",
      roundId: 1,
      runningCorrectAnswers: 1,
      selectedOptionId: "a",
      cameraPose: [1, 2, 3]
    })).toBe(false);
    expect(isClientEventPayload("session_ready", {
      playerId: "player-1",
      role: "participant"
    })).toBe(true);
    expect(isClientEventPayload("session_ready", {
      playerId: "player-1",
      role: "participant",
      sessionId: "private-transport-id"
    })).toBe(false);
  });

  it("accepts only the exact session identity request", () => {
    expect(isSessionRequestPayload({ protocolVersion: 1 })).toBe(true);
    expect(isSessionRequestPayload({ protocolVersion: 1, playerId: "client-claimed" })).toBe(false);
    expect(isSessionRequestPayload({ protocolVersion: 999 })).toBe(false);
  });
});
