import { describe, expect, it, vi } from "vitest";
import { WarRoomMatchmaker, type MatchmakingAdapter } from "./matchmaking";
import { WarRoomCommandError } from "./realtimeClient";
import { FakeRealtimeTransport } from "./test-support/fakeRealtimeTransport";

type Options = Parameters<MatchmakingAdapter["create"]>[0];

class FakeMatchmakingAdapter implements MatchmakingAdapter {
  createError: unknown;
  createOptions: Options | undefined;
  joinError: unknown;
  joinRequest: { readonly options: Options; readonly roomId: string } | undefined;

  constructor(readonly transport = new FakeRealtimeTransport()) {}

  async create(options: Options): Promise<FakeRealtimeTransport> {
    this.createOptions = options;
    if (this.createError !== undefined) throw this.createError;
    return this.transport;
  }

  async joinById(roomId: string, options: Options): Promise<FakeRealtimeTransport> {
    this.joinRequest = { options, roomId };
    if (this.joinError !== undefined) throw this.joinError;
    return this.transport;
  }
}

describe("War Room matchmaking", () => {
  it("creates and binds an organizer through the matchmaking seam", async () => {
    const adapter = new FakeMatchmakingAdapter();
    const attaching = new WarRoomMatchmaker(adapter).createOrganizer("Teacher");
    await vi.waitFor(() => expect(adapter.transport.sent).toContainEqual({ payload: { protocolVersion: 2 }, type: "request_session" }));

    adapter.transport.emitMessage("session_ready", { playerId: null, role: "organizer" });
    const client = await attaching;

    expect(adapter.createOptions).toEqual({ displayName: "Teacher", protocolVersion: 2 });
    expect(client.session).toEqual({ nickname: "Teacher", playerId: null, role: "organizer", roomId: "0427" });
    await client.dispose();
  });

  it("normalizes the room code before joining", async () => {
    const adapter = new FakeMatchmakingAdapter();
    const attaching = new WarRoomMatchmaker(adapter).joinParticipant(" 0427 ", "Ada");
    await vi.waitFor(() => expect(adapter.joinRequest?.roomId).toBe("0427"));

    adapter.transport.emitMessage("session_ready", { playerId: "player-1", role: "participant" });
    const client = await attaching;

    expect(adapter.joinRequest).toEqual({ options: { displayName: "Ada", protocolVersion: 2 }, roomId: "0427" });
    await client.dispose();
  });

  it.each([
    [new Error("NICKNAME_INVALID"), "NICKNAME_INVALID", false],
    [new Error('room "9999" not found'), "ROOM_NOT_FOUND", false],
    [new Error("0427 is already full."), "ROOM_FULL", false],
    [new Error('room "0427" is locked'), "ROOM_FULL", false],
    [new Error("fetch failed at https://internal.example"), "CONNECTION_FAILED", true]
  ] as const)("normalizes dependency failures without leaking raw messages", async (dependencyError, code, retryable) => {
    const adapter = new FakeMatchmakingAdapter();
    adapter.createError = dependencyError;

    const error = await new WarRoomMatchmaker(adapter).createOrganizer("Teacher").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(WarRoomCommandError);
    expect(error).toMatchObject({ code, retryable });
    expect((error as Error).message).not.toContain("internal.example");
  });

  it("rejects malformed room codes before calling the adapter", async () => {
    const adapter = new FakeMatchmakingAdapter();

    const error = await new WarRoomMatchmaker(adapter).joinParticipant("42", "Ada").catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "ROOM_NOT_FOUND", retryable: false });
    expect(adapter.joinRequest).toBeUndefined();
  });
});
