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
    expect(membership.removeConnectedParticipant("participant-session")).toBeUndefined();

    expect(membership.reconnect("participant-session")).toBe(participant);
    expect(player).toMatchObject({ connected: true, disconnectedAt: 0 });
    expect(membership.removeConnectedParticipant("participant-session")).toBe(participant);
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
    expect(membership.participantReconnectExpired("player-1")).toBe(false);

    state.phase = "battle";
    expect(membership.organizerReconnectPolicy()).toEqual({ closeRoomOnExpiry: false, graceMs: 20_000 });
    expect(membership.participantReconnectExpired("player-1")).toBe(true);
    expect(state.players.get("player-1")).toMatchObject({ eliminated: true, hp: 0 });
    expect(membership.participantReconnectExpired("player-1")).toBe(false);
  });
});
