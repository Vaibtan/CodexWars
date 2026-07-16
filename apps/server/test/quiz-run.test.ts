import { describe, expect, it } from "vitest";
import { PROGRAMMING_FUNDAMENTALS_V1 } from "@codexwars/shared";
import { QuizRun, type QuizRunPublisher } from "../src/rooms/quiz-run.js";
import { PlayerState, WarRoomState } from "../src/rooms/state.js";

interface PublishedEvent {
  readonly audience: "participant" | "room";
  readonly payload: unknown;
  readonly playerId?: string;
  readonly type: string;
}

function fixture(): { readonly events: PublishedEvent[]; readonly player: PlayerState; readonly quizRun: QuizRun; readonly state: WarRoomState } {
  const state = new WarRoomState();
  const player = new PlayerState();
  player.playerId = "player-1";
  player.displayName = "Ada";
  state.players.set(player.playerId, player);
  const events: PublishedEvent[] = [];
  const publisher: QuizRunPublisher = {
    participantEvent: (playerId, type, payload) => events.push({ audience: "participant", payload, playerId, type }),
    roomEvent: (type, payload) => events.push({ audience: "room", payload, type })
  };
  return { events, player, quizRun: new QuizRun(state, publisher), state };
}

describe("Quiz Run", () => {
  it("keeps a participant's running score private during question reveals", () => {
    const { events, player, quizRun, state } = fixture();
    const now = 1_000;

    expect(quizRun.start(now)).toBe(true);
    const question = PROGRAMMING_FUNDAMENTALS_V1.questions[0]!;
    expect(quizRun.submit(player.playerId, {
      command: "quiz_answer",
      commandId: "answer-1",
      optionId: question.answerOptionId,
      questionId: question.id,
      roundId: state.roundId
    }, now + 1)).toEqual({ ok: true });

    quizRun.advance(state.quiz.questionEndsAt);

    expect(player.correctAnswers).toBe(0);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ audience: "room", type: "quiz_question_started" }),
      expect.objectContaining({ audience: "participant", type: "quiz_answer_accepted" }),
      expect.objectContaining({ audience: "room", type: "quiz_question_revealed" }),
      expect.objectContaining({
        audience: "participant",
        payload: expect.objectContaining({ correct: true, runningCorrectAnswers: 1 }),
        type: "quiz_answer_result"
      })
    ]));
  });

  it("owns malformed-attempt limits and round reset", () => {
    const { quizRun, state } = fixture();
    expect(quizRun.start(1_000)).toBe(true);
    expect(Array.from({ length: 5 }, () => quizRun.recordMalformedAttempt("player-1"))).toEqual([true, true, true, true, true]);
    expect(quizRun.recordMalformedAttempt("player-1")).toBe(false);

    quizRun.reset();

    expect(state.quiz).toMatchObject({ questionIndex: -1, status: "ready", submittedCount: 0 });
  });

  it("publishes the finalized score and shield only when the Quiz Run completes", () => {
    const { events, player, quizRun, state } = fixture();
    let now = 1_000;
    expect(quizRun.start(now)).toBe(true);

    for (const [index, question] of PROGRAMMING_FUNDAMENTALS_V1.questions.entries()) {
      expect(quizRun.submit(player.playerId, {
        command: "quiz_answer",
        commandId: `answer-${index}`,
        optionId: question.answerOptionId,
        questionId: question.id,
        roundId: state.roundId
      }, now + 1)).toEqual({ ok: true });
      now = state.quiz.questionEndsAt;
      quizRun.advance(now);
      expect(player.correctAnswers).toBe(0);
      now = state.quiz.revealEndsAt;
      quizRun.advance(now);
    }

    expect(state.phase).toBe("localization");
    expect(player).toMatchObject({ correctAnswers: 10, quizCompleted: true, shield: 40 });
    expect(events.filter((event) => event.type === "quiz_completed")).toEqual([
      expect.objectContaining({
        audience: "participant",
        payload: expect.objectContaining({ correctAnswers: 10, startingShield: 40 })
      })
    ]);
  });
});
