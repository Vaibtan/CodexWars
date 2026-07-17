import { describe, expect, it } from "vitest";
import {
  createOpenAIQuizModelPort,
  estimatedTextCostUsd,
  QuizModelFailure,
  type ModelQuizCandidate,
  type ModelQuizReview
} from "../src/quiz/index.js";
import { selectPlayableCandidate, validateGeneratedCandidate } from "../src/quiz/quality.js";

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (apiKey === undefined || apiKey.length === 0) {
  throw new Error("OPENAI_API_KEY is required for the real OpenAI acceptance test");
}

function liveCase(name: string) {
  switch (name) {
    case "science-general":
      return {
        configuration: { category: "science", contentMode: "general_knowledge", currentEventsLookbackDays: 14, difficultyProfile: "balanced" } as const,
        maxCostUsd: 0.07,
        maxWebSearchCalls: 1
      };
    case "history-general":
      return {
        configuration: { category: "history", contentMode: "general_knowledge", currentEventsLookbackDays: 14, difficultyProfile: "balanced" } as const,
        maxCostUsd: 0.07,
        maxWebSearchCalls: 1
      };
    case "world-mixed":
      return {
        configuration: { category: "mixed", contentMode: "mixed", currentEventsLookbackDays: 14, difficultyProfile: "balanced" } as const,
        maxCostUsd: 0.08,
        maxWebSearchCalls: 1
      };
    case "world-current":
      return {
        configuration: { category: "mixed", contentMode: "current_events", currentEventsLookbackDays: 14, difficultyProfile: "balanced" } as const,
        maxCostUsd: 0.08,
        maxWebSearchCalls: 1
      };
    default:
      throw new Error(`Unknown LIVE_QUIZ_CASE: ${name}`);
  }
}

const liveCaseName = process.env.LIVE_QUIZ_CASE?.trim() || "science-general";
const selectedCase = liveCase(liveCaseName);

describe(`real OpenAI quiz generation: ${liveCaseName}`, () => {
  it("discovers evidence, generates, reviews, and validates a playable quiz through the production adapter", async () => {
    const now = Date.now();
    const model = createOpenAIQuizModelPort({ apiKey, maxWebSearchCalls: selectedCase.maxWebSearchCalls, searchContextSize: "low" });
    const request = {
      configuration: selectedCase.configuration,
      now,
      roomId: "live",
      roundId: 1
    } as const;

    let candidate: ModelQuizCandidate;
    let review: ModelQuizReview;
    let evidenceUsage = { inputTokens: 0, outputTokens: 0, searchCalls: 0 };
    try {
      const evidence = await model.discover(request, AbortSignal.timeout(120_000));
      evidenceUsage = evidence.usage;
      const generation = await model.generate(request, evidence, AbortSignal.timeout(120_000));
      candidate = generation.value;
      const reviewStage = await model.review(candidate, evidence, request, AbortSignal.timeout(30_000));
      review = reviewStage.value;
      evidenceUsage = {
        inputTokens: evidenceUsage.inputTokens + generation.usage.inputTokens + reviewStage.usage.inputTokens,
        outputTokens: evidenceUsage.outputTokens + generation.usage.outputTokens + reviewStage.usage.outputTokens,
        searchCalls: evidenceUsage.searchCalls
      };
    } catch (error) {
      const provider = error instanceof QuizModelFailure && error.cause instanceof Error ? error.cause : error;
      console.error(JSON.stringify({
        liveCase: liveCaseName,
        message: provider instanceof Error ? provider.message : String(provider),
        name: provider instanceof Error ? provider.name : "UnknownProviderError",
        reason: error instanceof QuizModelFailure ? error.reason : "unknown"
      }));
      throw new Error("Real OpenAI candidate or review request failed");
    }
    const selection = selectPlayableCandidate(candidate, review, request.configuration);
    const validation = selection === undefined
      ? { ok: false } as const
      : validateGeneratedCandidate(selection.candidate, selection.review, request.configuration, now, 3_600_000, "generated:01JZ8V7Y8TQ5B7MT3Y94K6Y8V2");

    const usage = {
      inputTokens: evidenceUsage.inputTokens,
      outputTokens: evidenceUsage.outputTokens,
      searchCalls: evidenceUsage.searchCalls
    };
    const estimatedCostUsd = estimatedTextCostUsd(usage) + usage.searchCalls * 0.01;
    console.warn(JSON.stringify({
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
      liveCase: liveCaseName,
      selectedQuestions: selection?.candidate.questions.length ?? 0,
      ...usage
    }));
    if (!validation.ok) {
      console.error(JSON.stringify({
        candidate: {
          categories: [...new Set(candidate.questions.map((question) => question.category))].sort(),
          currentEvents: candidate.questions.filter((question) => question.kind === "current_event").length,
          questionCount: candidate.questions.length,
          sourceCounts: candidate.questions.map((question) => question.sources.length),
          uniquePublishers: new Set(candidate.questions.flatMap((question) => question.sources.map((source) => source.publisher))).size
        },
        liveCase: liveCaseName,
        review: {
          approved: review.approved,
          rejected: review.questions.filter((question) => !question.classroomSafe
            || !question.difficultyAppropriate
            || !question.explanationConsistent
            || !question.factuallySupported
            || !question.stableForRoom
            || !question.unambiguous
            || question.issues.length > 0)
            .map((question) => ({
              failedChecks: [
                ...(!question.classroomSafe ? ["classroomSafe"] : []),
                ...(!question.difficultyAppropriate ? ["difficultyAppropriate"] : []),
                ...(!question.explanationConsistent ? ["explanationConsistent"] : []),
                ...(!question.factuallySupported ? ["factuallySupported"] : []),
                ...(!question.stableForRoom ? ["stableForRoom"] : []),
                ...(!question.unambiguous ? ["unambiguous"] : [])
              ],
              issueCount: question.issues.length,
              issueCodes: question.issues,
              order: question.order
            }))
        }
      }));
    }

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.template.questions).toHaveLength(10);
    expect(validation.sources.length).toBeGreaterThan(0);

    expect(estimatedCostUsd).toBeLessThanOrEqual(selectedCase.maxCostUsd);
  });
});
