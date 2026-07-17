import { describe, expect, it } from "vitest";
import { WarRoomMembership } from "../src/rooms/membership.js";
import { WarRoomState } from "../src/rooms/state.js";

describe("War Room membership", () => {
  it("owns role, session, participant identity, and unique display names", () => {
    const state = new WarRoomState();
    const membership = new WarRoomMembership(state);

    const organizer = membership.join("organizer-session", "Teacher");
    const first = membership.join("participant-1", "Ada");
    const second = membership.join("participant-2", "Ada");

    expect(organizer.kind).toBe("organizer");
    expect(first).toMatchObject({ kind: "participant", playerId: "player-1" });
    expect(second).toMatchObject({ kind: "participant", playerId: "player-2" });
    expect(state.organizer).toMatchObject({ connected: true, displayName: "Teacher" });
    expect([...state.players.values()].map((player) => player.displayName)).toEqual(["Ada", "Ada (2)"]);
    expect(membership.memberForSession("participant-1")).toBe(first);
    expect(membership.sessionIdForPlayer("player-2")).toBe("participant-2");
  });

  it("applies drop and reconnect state while retaining the same participant", () => {
    const state = new WarRoomState();
    const membership = new WarRoomMembership(state);
    membership.join("organizer-session", "Teacher");
    const participant = membership.join("participant-session", "Ada");
    expect(participant.kind).toBe("participant");
    const player = state.players.get("player-1")!;
    player.ready = true;

    expect(membership.drop("participant-session", 1_500)).toBe(participant);
    expect(player).toMatchObject({ connected: false, disconnectedAt: 1_500, ready: false });
    expect(membership.leaveConnectedParticipant("participant-session", 1_501)).toBeUndefined();

    expect(membership.reconnect("participant-session")).toBe(participant);
    expect(player).toMatchObject({ connected: true, disconnectedAt: 0 });
    expect(membership.leaveConnectedParticipant("participant-session", 1_502)).toEqual({ disposition: "removed", participant });
    expect(state.players.size).toBe(0);
  });

  it("owns active-round reconnect expiry policy", () => {
    const state = new WarRoomState();
    const membership = new WarRoomMembership(state);
    membership.join("organizer-session", "Teacher");
    const participant = membership.join("participant-session", "Ada");
    expect(participant.kind).toBe("participant");

    expect(membership.organizerReconnectPolicy()).toEqual({ closeRoomOnExpiry: true, graceMs: 60_000 });
    membership.drop("participant-session", 1_000);

    state.phase = "battle";
    expect(membership.organizerReconnectPolicy()).toEqual({ closeRoomOnExpiry: false, graceMs: 20_000 });
    expect(membership.participantReconnectExpired("player-1")).toBe("eliminated");
    expect(state.players.get("player-1")).toMatchObject({ eliminated: true, hp: 0 });
    expect(membership.participantReconnectExpired("player-1")).toBeUndefined();
  });

  it("excludes rather than eliminates a participant when pre-battle reconnect grace expires", () => {
    const state = new WarRoomState();
    const membership = new WarRoomMembership(state);
    membership.join("organizer-session", "Teacher");
    membership.join("participant-session", "Ada");
    const player = state.players.get("player-1")!;
    state.phase = "positioning";
    player.localization = "localized";
    player.positionLocked = true;
    player.positionX = 2;
    player.positionZ = 1;
    player.ready = true;

    membership.drop("participant-session", 1_000);
    membership.participantReconnectExpired("player-1");

    expect(player).toMatchObject({
      combatIncluded: false,
      connected: false,
      eliminated: false,
      hp: 100,
      positionLocked: false,
      positionX: 0,
      positionZ: 0,
      ready: false
    });
  });

  it.each(["quiz", "localization", "positioning"] as const)("retains and excludes an explicit participant leave during %s", (phase) => {
    const state = new WarRoomState();
    const membership = new WarRoomMembership(state);
    membership.join("organizer-session", "Teacher");
    const participant = membership.join("participant-session", "Ada");
    expect(participant.kind).toBe("participant");
    const player = state.players.get("player-1")!;
    state.phase = phase;
    player.positionLocked = true;
    player.positionX = 2;
    player.ready = true;

    expect(membership.leaveConnectedParticipant("participant-session", 2_000)).toEqual({ disposition: "retained", participant });
    expect(player).toMatchObject({ combatIncluded: false, connected: false, positionLocked: false, positionX: 0, ready: false });
  });

  it.each(["countdown", "battle"] as const)("retains and eliminates an explicit participant leave during %s", (phase) => {
    const state = new WarRoomState();
    const membership = new WarRoomMembership(state);
    membership.join("organizer-session", "Teacher");
    const participant = membership.join("participant-session", "Ada");
    expect(participant.kind).toBe("participant");
    state.phase = phase;

    expect(membership.leaveConnectedParticipant("participant-session", 2_000)).toEqual({ disposition: "eliminated", participant });
    expect(state.players.get("player-1")).toMatchObject({ combatIncluded: true, connected: false, eliminated: true, hp: 0 });
    expect(membership.leaveConnectedParticipant("participant-session", 2_001)).toBeUndefined();
  });

  it("owns combat inclusion and complete participant reset between rounds", () => {
    const state = new WarRoomState();
    const membership = new WarRoomMembership(state);
    membership.join("organizer-session", "Teacher");
    const retained = membership.join("participant-1", "Ada");
    const departed = membership.join("participant-2", "Grace");
    expect(retained.kind).toBe("participant");
    expect(departed.kind).toBe("participant");
    if (retained.kind !== "participant" || departed.kind !== "participant") throw new Error("Expected participants");
    retained.commandOutcomes.set("old-command", { command: "ready_changed", commandId: "old-command", roundId: 1, serverNow: 1_000 });
    const player = state.players.get(retained.playerId)!;
    Object.assign(player, {
      characterColorId: "violet",
      characterId: "wizard",
      correctAnswers: 7,
      eliminated: true,
      hp: 0,
      localization: "localized",
      positionLocked: true,
      positionX: 2,
      quizCompleted: true,
      ready: true,
      shield: 15
    });
    membership.drop(departed.sessionId, 2_000);

    expect(membership.setCombatIncluded(retained.playerId, false)).toBe(true);
    expect(player).toMatchObject({ combatIncluded: false, localization: "not_started", positionLocked: false, ready: false });
    membership.resetRound();

    expect(state.players.has(departed.playerId)).toBe(false);
    expect(player).toMatchObject({
      characterColorId: "gold",
      characterId: "default",
      combatIncluded: true,
      correctAnswers: 0,
      eliminated: false,
      hp: 100,
      localization: "not_started",
      positionLocked: false,
      quizCompleted: false,
      ready: false,
      shield: 0
    });
    expect(retained.commandOutcomes.size).toBe(0);
  });
});
