import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, ColyseusTestServer } from "@colyseus/testing";
import { GENERAL_KNOWLEDGE_FALLBACK_V1, type QuizTemplate } from "@codexwars/shared";
import appConfig from "../src/app.config.js";
import type { PreparedQuiz, QuizPreparation } from "../src/quiz/index.js";
import { setWarRoomDependenciesForTest } from "../src/rooms/war-room.js";
import { WarRoomHarness } from "./support/war-room-harness.js";

let colyseus: ColyseusTestServer;

beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
beforeEach(async () => { await colyseus.cleanup(); });

function generatedQuiz(): PreparedQuiz {
  const template: QuizTemplate = { ...GENERAL_KNOWLEDGE_FALLBACK_V1, id: "generated:test-quiz" };
  return {
    provenance: { generatedAt: 1_000, model: "gpt-5.4-mini-2026-03-17", promptVersion: "quiz-v1", usage: { inputTokens: 100, outputTokens: 50, searchCalls: 1 } },
    source: "generated",
    sources: [{ publisher: "Example", title: "Evidence", url: "https://example.com/evidence" }],
    template
  };
}

describe("War Room quiz preparation", () => {
  it("keeps generated content organizer-private until approval and then freezes it for play", async () => {
    let now = 1_000;
    const prepare = vi.fn<QuizPreparation["prepare"]>().mockResolvedValue(generatedQuiz());
    const restore = setWarRoomDependenciesForTest({ log: () => undefined, now: () => now, quizPreparation: { prepare } });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      await harness.joinParticipant("Ada");
      const preview = harness.organizer.waitForMessage("quiz_prepared");
      await harness.sendAndPatch(harness.organizer, "configure_quiz", { ...harness.command(), category: "mixed", contentMode: "general_knowledge", currentEventsLookbackDays: 14, difficultyProfile: "balanced" });
      await harness.sendAndPatch(harness.organizer, "prepare_quiz", harness.command());
      while (harness.room.state.quiz.status === "generating") await harness.waitForPatch();

      expect(await preview).toMatchObject({ source: "generated", templateId: "generated:test-quiz" });
      expect(harness.room.state.quiz).toMatchObject({ source: "generated", status: "awaiting_approval", templateId: "generated:test-quiz" });
      expect(JSON.stringify(harness.room.state)).not.toContain("answerOptionId");
      await expect(harness.commandError(harness.organizer, "start_quiz", harness.command())).resolves.toMatchObject({ code: "QUIZ_APPROVAL_REQUIRED" });
      await harness.sendAndPatch(harness.organizer, "approve_quiz", harness.command());
      await harness.sendAndPatch(harness.organizer, "start_quiz", harness.command());
      expect(harness.room.state.phase).toBe("quiz");
      await harness.finishQuiz((value) => { now = value; });
      expect(harness.room.state.phase).toBe("localization");
      expect(prepare).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("deduplicates requests and ignores a completion after organizer cancellation", async () => {
    let resolve!: (quiz: PreparedQuiz) => void;
    const prepare = vi.fn<QuizPreparation["prepare"]>().mockImplementation(() => new Promise((done) => { resolve = done; }));
    const restore = setWarRoomDependenciesForTest({ log: () => undefined, quizPreparation: { prepare } });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      await harness.sendAndPatch(harness.organizer, "configure_quiz", { ...harness.command(), category: "mixed", contentMode: "general_knowledge", currentEventsLookbackDays: 14, difficultyProfile: "balanced" });
      const request = harness.command("prepare");
      await harness.sendAndPatch(harness.organizer, "prepare_quiz", request);
      await harness.sendAndPatch(harness.organizer, "prepare_quiz", request);
      expect(prepare).toHaveBeenCalledTimes(1);
      await harness.sendAndPatch(harness.organizer, "cancel_quiz_preparation", harness.command());
      resolve(generatedQuiz());
      await Promise.resolve();
      expect(harness.room.state.quiz).toMatchObject({ status: "configured", templateId: "" });
    } finally {
      restore();
    }
  });

  it("enforces the per-round regeneration allowance", async () => {
    const restore = setWarRoomDependenciesForTest({ log: () => undefined, maxRegenerationsPerRound: 1 });
    try {
      const harness = await WarRoomHarness.create(colyseus);
      await harness.prepareQuiz();
      await harness.sendAndPatch(harness.organizer, "regenerate_quiz", harness.command());
      while (harness.room.state.quiz.status === "generating") await harness.waitForPatch();
      await expect(harness.commandError(harness.organizer, "regenerate_quiz", harness.command())).resolves.toMatchObject({ code: "QUIZ_GENERATION_LIMIT_REACHED" });
    } finally {
      restore();
    }
  });
});
