import { describe, expect, it } from "vitest";
import type { PublicRoomState } from "@codexwars/shared";
import {
  attachWarRoomRealtimeClient,
} from "./realtimeClient";
import { FakeRealtimeTransport } from "./test-support/fakeRealtimeTransport";

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
  protocolVersion: 2,
  quiz: {
    category: "mixed",
    contentMode: "general_knowledge",
    currentEventsLookbackDays: 14,
    difficultyProfile: "balanced",
    currentQuestion: { difficulty: "", durationMs: 0, id: "", options: [], order: 0, prompt: "" },
    eligibleCount: 0,
    questionCount: 10,
    questionEndsAt: 0,
    questionIndex: -1,
    regenerationCount: 0,
    revealEndsAt: 0,
    revealedCorrectOptionId: "",
    revealedExplanation: "",
    source: "fallback",
    status: "fallback_ready",
    submittedCount: 0,
    templateId: "fallback:general-knowledge-v1",
  },
  roomId: "0427",
  roundId: 1,
  serverNow: 1_000,
};

describe("WarRoomRealtimeClient", () => {
  it("maps organizer quiz configuration and retains only validated private previews", async () => {
    const transport = new FakeRealtimeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Teacher", role: "organizer", transport });
    transport.emitMessage("session_ready", { playerId: null, role: "organizer" });
    const client = await attaching;
    transport.emitState({ ...roomState, players: {} });

    const sending = client.send("configure_quiz", { category: "mixed", contentMode: "mixed", currentEventsLookbackDays: 14, difficultyProfile: "balanced" });
    const command = transport.sent.at(-1)!;
    expect(command).toMatchObject({ payload: { category: "mixed", contentMode: "mixed", currentEventsLookbackDays: 14, difficultyProfile: "balanced", roundId: 1 }, type: "configure_quiz" });
    const commandId = (command.payload as { commandId: string }).commandId;
    transport.emitMessage("command_accepted", { command: "configure_quiz", commandId, roundId: 1, serverNow: 1_001 });
    await sending;

    transport.emitMessage("quiz_prepared", {
      generatedAt: 1_000,
      preparationId: "prep-1",
      questions: [{ difficulty: "basic", durationMs: 30_000, id: "q-01", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }, { id: "d", label: "D" }], order: 1, prompt: "Which answer is correct?" }],
      roundId: 1,
      source: "generated",
      sources: [{ publisher: "Example", title: "Evidence", url: "https://example.com/evidence" }],
      templateId: "generated:test"
    });
    expect(client.getSnapshot().quizPreview).toMatchObject({ preparationId: "prep-1", source: "generated" });
  });

  it("binds server identity, validates synchronized state, and acknowledges exact commands", async () => {
    const transport = new FakeRealtimeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Ada", role: "participant", transport });

    expect(transport.sent).toEqual([{ payload: { protocolVersion: 2 }, type: "request_session" }]);
    transport.emitMessage("session_ready", { playerId: "player-1", role: "participant" });
    const client = await attaching;

    transport.emitState(roomState);
    expect(client.getSnapshot()).toMatchObject({
      connected: true,
      loading: false,
      room: roomState,
      session: { nickname: "Ada", playerId: "player-1", role: "participant", roomId: "0427" },
    });

    const sending = client.send("select_character", { characterId: "wizard", colorId: "violet" });
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
    const transport = new FakeRealtimeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Ada", role: "participant", transport });
    transport.emitMessage("session_ready", { playerId: "player-1", role: "participant" });
    const client = await attaching;

    transport.emitState({ ...roomState, organizerToken: "must-not-enter-client-state" });
    expect(client.getSnapshot().error?.message).toContain("Invalid synchronized War Room state");

    transport.emitState(roomState);
    const sending = client.send("ready_changed", { ready: true });
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
    const transport = new FakeRealtimeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Ada", role: "participant", transport });

    transport.emitMessage("session_ready", { playerId: null, role: "organizer" });

    await expect(attaching).rejects.toThrow("role did not match");
    expect(transport.leaveCalls).toBe(1);
  });

  it("normalizes active connection errors without exposing SDK messages", async () => {
    const transport = new FakeRealtimeTransport();
    const attaching = attachWarRoomRealtimeClient({ nickname: "Ada", role: "participant", transport });
    transport.emitMessage("session_ready", { playerId: "player-1", role: "participant" });
    const client = await attaching;

    transport.emitError(4_211, "private dependency failure");
    expect(client.getSnapshot().error).toMatchObject({ code: "CONNECTION_FAILED", retryable: true });
    expect(client.getSnapshot().error?.message).not.toContain("private dependency failure");

    transport.emitLeave(4_000);
    expect(client.getSnapshot().error).toMatchObject({ code: "SESSION_EXPIRED", retryable: false });
  });
});
