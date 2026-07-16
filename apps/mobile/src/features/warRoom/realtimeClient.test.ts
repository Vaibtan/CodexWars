import { describe, expect, it } from "vitest";
import type { PublicRoomState } from "@codexwars/shared";
import {
  attachWarRoomRealtimeClient,
  type RealtimeTransport,
  type Unsubscribe,
} from "./realtimeClient";

type MessageListener = (payload: unknown) => void;

class FakeTransport implements RealtimeTransport {
  readonly roomId = "0427";
  readonly sent: Array<{ readonly payload: unknown; readonly type: string }> = [];
  leaveCalls = 0;
  private readonly dropListeners = new Set<() => void>();
  private readonly errorListeners = new Set<(code: number, message: string) => void>();
  private readonly leaveListeners = new Set<(code: number) => void>();
  private readonly messageListeners = new Map<string, Set<MessageListener>>();
  private readonly reconnectListeners = new Set<() => void>();
  private readonly stateListeners = new Set<(state: unknown) => void>();

  async leave(): Promise<void> {
    this.leaveCalls += 1;
  }

  onDrop(listener: () => void): Unsubscribe {
    this.dropListeners.add(listener);
    return () => this.dropListeners.delete(listener);
  }

  onError(listener: (code: number, message: string) => void): Unsubscribe {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onLeave(listener: (code: number) => void): Unsubscribe {
    this.leaveListeners.add(listener);
    return () => this.leaveListeners.delete(listener);
  }

  onMessage(type: string, listener: MessageListener): Unsubscribe {
    const listeners = this.messageListeners.get(type) ?? new Set<MessageListener>();
    listeners.add(listener);
    this.messageListeners.set(type, listeners);
    return () => listeners.delete(listener);
  }

  onReconnect(listener: () => void): Unsubscribe {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  onStateChange(listener: (state: unknown) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  send(type: string, payload: unknown): void {
    this.sent.push({ payload, type });
  }

  emitMessage(type: string, payload: unknown): void {
    for (const listener of this.messageListeners.get(type) ?? []) listener(payload);
  }

  emitState(state: unknown): void {
    for (const listener of this.stateListeners) listener(state);
  }
}

const roomState: PublicRoomState = {
  arena: { configured: true, markerExclusionRadiusM: 0.5, minimumSpacingM: 1.5, radiusM: 3 },
  battle: { completionReason: "", endsAt: 0, standings: [], startsAt: 0, status: "not_started", winnerId: "" },
  eventSequence: 0,
  organizer: { connected: true, displayName: "Teacher" },
  phase: "lobby",
  players: {
    "player-1": {
      characterColorId: "gold",
      characterId: "knight",
      charges: -1,
      combatIncluded: true,
      connected: true,
      correctAnswers: 0,
      disconnectedAt: 0,
      displayName: "Ada",
      eliminated: false,
      hasAnsweredCurrent: false,
      hp: 100,
      localization: "not_started",
      maxHp: 100,
      nextAttackAt: 0,
      playerId: "player-1",
      positionLocked: false,
      positionX: 0,
      positionZ: 0,
      quizCompleted: false,
      ready: false,
      shield: 0,
      weaponId: "bolt",
    },
  },
  protocolVersion: 1,
  quiz: {
    currentQuestion: { difficulty: "", durationMs: 0, id: "", options: [], order: 0, prompt: "" },
    eligibleCount: 0,
    questionCount: 10,
    questionEndsAt: 0,
    questionIndex: -1,
    revealEndsAt: 0,
    revealedCorrectOptionId: "",
    revealedExplanation: "",
    status: "ready",
    submittedCount: 0,
    templateId: "programming-fundamentals-v1",
  },
  roomId: "0427",
  roundId: 1,
  serverNow: 1_000,
};

describe("WarRoomRealtimeClient", () => {
  it("binds server identity, validates synchronized state, and acknowledges exact commands", async () => {
    const transport = new FakeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Ada", role: "participant", transport });

    expect(transport.sent).toEqual([{ payload: { protocolVersion: 1 }, type: "request_session" }]);
    transport.emitMessage("session_ready", { playerId: "player-1", role: "participant" });
    const client = await attaching;

    transport.emitState(roomState);
    expect(client.getSnapshot()).toMatchObject({
      connected: true,
      loading: false,
      room: roomState,
      session: { nickname: "Ada", playerId: "player-1", role: "participant", roomId: "0427" },
    });

    const sending = client.send({ selection: { characterId: "wizard", colorId: "violet" }, type: "select_character" });
    const sentCommand = transport.sent.at(-1)!;
    expect(sentCommand).toMatchObject({
      payload: { characterId: "wizard", colorId: "violet", roundId: 1 },
      type: "select_character",
    });
    const commandId = (sentCommand.payload as { commandId: string }).commandId;
    expect(commandId).toEqual(expect.any(String));

    transport.emitMessage("command_accepted", { command: "select_character", commandId, roundId: 1, serverNow: 1_010 });
    await expect(sending).resolves.toEqual({ command: "select_character", commandId, roundId: 1, serverNow: 1_010 });

    await client.dispose();
    expect(transport.leaveCalls).toBe(1);
  });

  it("rejects authority-shaped state and correlated server errors", async () => {
    const transport = new FakeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Ada", role: "participant", transport });
    transport.emitMessage("session_ready", { playerId: "player-1", role: "participant" });
    const client = await attaching;

    transport.emitState({ ...roomState, organizerToken: "must-not-enter-client-state" });
    expect(client.getSnapshot().error?.message).toContain("Invalid synchronized War Room state");

    transport.emitState(roomState);
    const sending = client.send({ type: "ready_changed", ready: true });
    const commandId = (transport.sent.at(-1)!.payload as { commandId: string }).commandId;
    transport.emitMessage("server_error", {
      code: "NOT_LOCALIZED",
      commandId,
      message: "not localized",
      retryable: false,
      roundId: 1,
    });
    await expect(sending).rejects.toThrow("not localized");
  });

  it("closes the reserved seat when server identity does not match the requested role", async () => {
    const transport = new FakeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Ada", role: "participant", transport });

    transport.emitMessage("session_ready", { playerId: null, role: "organizer" });

    await expect(attaching).rejects.toThrow("role did not match");
    expect(transport.leaveCalls).toBe(1);
  });
});
