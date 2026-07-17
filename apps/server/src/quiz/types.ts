import type { QuizCategory, QuizConfiguration, QuizDifficulty, QuizEvidenceSource, QuizTemplate, QuizTemplateSource, RoundId, RoomId } from "@codexwars/shared";

export type QuizModelFailureReason = "authentication" | "invalid_request" | "malformed_output" | "rate_limited" | "refusal" | "upstream_unavailable";
export type QuizFallbackReason = QuizModelFailureReason | "budget_exhausted" | "circuit_open" | "generation_disabled" | "timeout" | "validation_failed";

export class QuizModelFailure extends Error {
  constructor(readonly reason: QuizModelFailureReason, readonly transient: boolean, cause?: unknown) {
    super(reason, { cause });
    this.name = "QuizModelFailure";
  }
}

export class QuizPreparationCancelledError extends Error {
  constructor() {
    super("quiz preparation cancelled");
    this.name = "QuizPreparationCancelledError";
  }
}

export interface ModelEvidenceSource extends QuizEvidenceSource {
  readonly retrievedAt: number;
}

export interface ModelQuizQuestion {
  readonly answerIndex: number;
  readonly category: QuizCategory;
  readonly difficulty: QuizDifficulty;
  readonly explanation: string;
  readonly kind: "current_event" | "evergreen";
  readonly options: readonly string[];
  readonly prompt: string;
  readonly sources: readonly ModelEvidenceSource[];
}

export interface ModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly searchCalls: number;
}

export type QuizReviewIssueCode =
  | "ambiguous_answer"
  | "difficulty_mismatch"
  | "duplicate_question"
  | "explanation_mismatch"
  | "implausible_options"
  | "insufficient_sources"
  | "unsafe_content"
  | "unstable_claim"
  | "unsupported_fact";

export interface ModelQuizCandidate {
  readonly questions: readonly ModelQuizQuestion[];
  readonly reviewContext?: { readonly evidenceBrief: string };
  readonly title: string;
  readonly usage?: ModelUsage;
}

export interface ModelQuestionReview {
  readonly classroomSafe: boolean;
  readonly difficultyAppropriate: boolean;
  readonly explanationConsistent: boolean;
  readonly factuallySupported: boolean;
  readonly issues: readonly QuizReviewIssueCode[];
  readonly order: number;
  readonly stableForRoom: boolean;
  readonly unambiguous: boolean;
}

export interface ModelQuizReview {
  readonly approved: boolean;
  readonly questions: readonly ModelQuestionReview[];
  readonly usage?: Omit<ModelUsage, "searchCalls">;
}

export interface QuizModelRequest {
  readonly configuration: QuizConfiguration;
  readonly now: number;
  readonly roomId: RoomId;
  readonly roundId: RoundId;
}

export interface QuizModelPort {
  generate(request: QuizModelRequest, signal: AbortSignal): Promise<ModelQuizCandidate>;
  review(candidate: ModelQuizCandidate, request: QuizModelRequest, signal: AbortSignal): Promise<ModelQuizReview>;
}

export interface QuizPreparationRequest {
  readonly configuration: QuizConfiguration;
  readonly preparationId: string;
  readonly roomId: RoomId;
  readonly roundId: RoundId;
}

export interface QuizProvenance {
  readonly fallbackReason?: QuizFallbackReason;
  readonly generatedAt: number;
  readonly model: "gpt-5.4-mini-2026-03-17";
  readonly promptVersion: "quiz-v1";
  readonly usage: ModelUsage;
}

export interface PreparedQuiz {
  readonly provenance: QuizProvenance;
  readonly source: QuizTemplateSource;
  readonly sources: readonly QuizEvidenceSource[];
  readonly template: QuizTemplate;
}

export interface QuizPreparation {
  prepare(request: QuizPreparationRequest, signal: AbortSignal): Promise<PreparedQuiz>;
}

export interface QuizPreparationPolicy {
  readonly circuitCooldownMs?: number;
  readonly circuitFailureThreshold?: number;
  readonly deadlineMs: number;
  readonly developingStoryCutoffMs: number;
  readonly retryLimit: number;
}
