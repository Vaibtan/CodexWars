import { ArraySchema } from "@colyseus/schema";
import {
  PROGRAMMING_FUNDAMENTALS_V1,
  MAX_MALFORMED_QUIZ_ATTEMPTS,
  QUIZ,
  publicQuizQuestion,
  startingShieldForScore,
  type ClientEventPayloads,
  type ErrorCode,
  type PlayerId,
  type ServerEventPayloads,
  type ValidatedCommand
} from "@codexwars/shared";
import { QuizOptionState, QuizQuestionState, QuizState, WarRoomState } from "./state.js";

type QuizClientEventName = "quiz_answer_accepted" | "quiz_answer_result" | "quiz_completed";
type QuizServerEventName = "quiz_question_revealed" | "quiz_question_started";

export interface QuizRunPublisher {
  participantEvent<Name extends QuizClientEventName>(playerId: PlayerId, type: Name, payload: ClientEventPayloads[Name]): void;
  roomEvent<Name extends QuizServerEventName>(type: Name, payload: ServerEventPayloads[Name]): void;
}

interface ParticipantQuizState {
  readonly answers: Map<string, string>;
  readonly malformedAttempts: Map<string, number>;
  runningCorrectAnswers: number;
}

type QuizSubmission = { readonly ok: true } | { readonly code: ErrorCode; readonly ok: false };

export class QuizRun {
  private frozenCohort = new Set<PlayerId>();
  private readonly participants = new Map<PlayerId, ParticipantQuizState>();

  constructor(
    private readonly state: WarRoomState,
    private readonly publisher: QuizRunPublisher
  ) {}

  selectTemplate(): boolean {
    if (this.state.phase !== "lobby") return false;
    this.state.quiz.status = "ready";
    return true;
  }

  start(now: number): boolean {
    if (this.state.phase !== "lobby" || this.state.players.size === 0 || this.state.quiz.status !== "ready") return false;
    this.frozenCohort = new Set(this.state.players.keys());
    for (const playerId of this.frozenCohort) this.participantState(playerId);
    this.state.quiz.eligibleCount = this.frozenCohort.size;
    this.state.phase = "quiz";
    this.startQuestion(0, now);
    return true;
  }

  submit(playerId: PlayerId, command: Extract<ValidatedCommand, { command: "quiz_answer" }>, now: number): QuizSubmission {
    const question = PROGRAMMING_FUNDAMENTALS_V1.questions[this.state.quiz.questionIndex];
    const player = this.state.players.get(playerId);
    if (question === undefined || player === undefined || !this.frozenCohort.has(playerId) || this.state.quiz.status !== "question") {
      return { code: "PHASE_MISMATCH", ok: false };
    }
    if (command.questionId !== question.id) return { code: "QUESTION_MISMATCH", ok: false };
    if (!question.options.some((option) => option.id === command.optionId)) return { code: "ANSWER_OPTION_INVALID", ok: false };
    if (now >= this.state.quiz.questionEndsAt) return { code: "ANSWER_LATE", ok: false };
    const participant = this.participantState(playerId);
    if (participant.answers.has(question.id)) return { code: "ANSWER_DUPLICATE", ok: false };

    participant.answers.set(question.id, command.optionId);
    player.hasAnsweredCurrent = true;
    this.state.quiz.submittedCount += 1;
    this.publisher.participantEvent(playerId, "quiz_answer_accepted", {
      acceptedAt: now,
      commandId: command.commandId,
      questionId: question.id,
      roundId: this.state.roundId
    });
    return { ok: true };
  }

  advance(now: number): void {
    if (this.state.phase !== "quiz") return;
    if (this.state.quiz.status === "question" && now >= this.state.quiz.questionEndsAt) {
      this.revealQuestion(now);
      return;
    }
    if (this.state.quiz.status === "reveal" && now >= this.state.quiz.revealEndsAt) {
      this.startQuestion(this.state.quiz.questionIndex + 1, now);
    }
  }

  recordMalformedAttempt(playerId: PlayerId): boolean {
    const questionId = this.state.quiz.currentQuestion.id;
    if (questionId.length === 0) return true;
    const attempts = this.participantState(playerId).malformedAttempts;
    const attempted = attempts.get(questionId) ?? 0;
    if (attempted >= MAX_MALFORMED_QUIZ_ATTEMPTS) return false;
    attempts.set(questionId, attempted + 1);
    return true;
  }

  removeParticipant(playerId: PlayerId): void {
    this.participants.delete(playerId);
  }

  reset(): void {
    this.state.quiz = new QuizState();
    this.frozenCohort.clear();
    this.participants.clear();
  }

  private startQuestion(questionIndex: number, now: number): void {
    const question = PROGRAMMING_FUNDAMENTALS_V1.questions[questionIndex];
    if (question === undefined) {
      this.completeQuiz();
      return;
    }
    this.state.quiz.status = "question";
    this.state.quiz.questionIndex = questionIndex;
    this.state.quiz.questionEndsAt = now + question.durationMs;
    this.state.quiz.revealEndsAt = 0;
    this.state.quiz.revealedCorrectOptionId = "";
    this.state.quiz.revealedExplanation = "";
    this.state.quiz.submittedCount = 0;
    this.state.quiz.currentQuestion = this.toQuestionState(publicQuizQuestion(question));
    for (const playerId of this.frozenCohort) {
      const player = this.state.players.get(playerId);
      if (player !== undefined) player.hasAnsweredCurrent = false;
    }
    this.publisher.roomEvent("quiz_question_started", {
      questionEndsAt: this.state.quiz.questionEndsAt,
      questionId: question.id,
      questionIndex
    });
  }

  private revealQuestion(now: number): void {
    const question = PROGRAMMING_FUNDAMENTALS_V1.questions[this.state.quiz.questionIndex];
    if (question === undefined) return;
    this.state.quiz.status = "reveal";
    this.state.quiz.revealedCorrectOptionId = question.answerOptionId;
    this.state.quiz.revealedExplanation = question.explanation;
    this.state.quiz.revealEndsAt = now + QUIZ.REVEAL_MS;
    this.publisher.roomEvent("quiz_question_revealed", {
      correctOptionId: question.answerOptionId,
      explanation: question.explanation,
      questionId: question.id,
      revealEndsAt: this.state.quiz.revealEndsAt
    });

    for (const playerId of this.frozenCohort) {
      const player = this.state.players.get(playerId);
      if (player === undefined) continue;
      const participant = this.participantState(playerId);
      const selectedOptionId = participant.answers.get(question.id);
      const correct = selectedOptionId === question.answerOptionId;
      if (correct) participant.runningCorrectAnswers += 1;
      player.correctAnswers = participant.runningCorrectAnswers;
      this.publisher.participantEvent(playerId, "quiz_answer_result", {
        correct,
        questionId: question.id,
        roundId: this.state.roundId,
        runningCorrectAnswers: participant.runningCorrectAnswers,
        ...(selectedOptionId === undefined ? {} : { selectedOptionId })
      });
    }
  }

  private completeQuiz(): void {
    this.state.quiz.status = "completed";
    this.state.phase = "localization";
    this.state.quiz.currentQuestion = new QuizQuestionState();
    for (const playerId of this.frozenCohort) {
      const player = this.state.players.get(playerId);
      if (player === undefined) continue;
      const correctAnswers = this.participantState(playerId).runningCorrectAnswers;
      player.correctAnswers = correctAnswers;
      player.quizCompleted = true;
      player.shield = startingShieldForScore(correctAnswers);
      this.publisher.participantEvent(playerId, "quiz_completed", {
        correctAnswers,
        questionCount: QUIZ.QUESTION_COUNT,
        roundId: this.state.roundId,
        startingShield: player.shield
      });
    }
  }

  private participantState(playerId: PlayerId): ParticipantQuizState {
    let participant = this.participants.get(playerId);
    if (participant === undefined) {
      participant = { answers: new Map(), malformedAttempts: new Map(), runningCorrectAnswers: 0 };
      this.participants.set(playerId, participant);
    }
    return participant;
  }

  private toQuestionState(question: ReturnType<typeof publicQuizQuestion>): QuizQuestionState {
    const state = new QuizQuestionState();
    state.id = question.id;
    state.order = question.order;
    state.prompt = question.prompt;
    state.difficulty = question.difficulty;
    state.durationMs = question.durationMs;
    const options = new ArraySchema<QuizOptionState>();
    for (const option of question.options) {
      const optionState = new QuizOptionState();
      optionState.id = option.id;
      optionState.label = option.label;
      options.push(optionState);
    }
    state.options = options;
    return state;
  }
}
