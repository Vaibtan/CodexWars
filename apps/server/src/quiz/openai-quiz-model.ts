import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, Output, generateText } from "ai";
import { z } from "zod";
import { QUIZ } from "@codexwars/shared";
import { createEvidenceCatalog, resolveEvidenceReferences, type EvidenceCatalog } from "./evidence-catalog.js";
import { generatedQuestionKind, materializeGeneratedAnswer, TRUSTED_SOURCE_DOMAINS } from "./quality.js";
import { QuizModelFailure, type ModelQuizCandidate, type ModelQuizReview, type QuizModelPort, type QuizModelRequest, type QuizReviewIssueCode } from "./types.js";

const MODEL = "gpt-5.4-mini-2026-03-17";
const MODEL_QUESTION_COUNT = 16;
const EVIDENCE_MAX_OUTPUT_TOKENS = 3_000;
const CANDIDATE_MAX_OUTPUT_TOKENS = 8_000;
const REVIEW_MAX_OUTPUT_TOKENS = 4_000;

type SearchContextSize = "low" | "medium";

const REVIEW_ISSUE_CODES = [
  "ambiguous_answer", "difficulty_mismatch", "duplicate_question", "explanation_mismatch", "implausible_options",
  "insufficient_sources", "unsafe_content", "unstable_claim", "unsupported_fact"
] as const satisfies readonly QuizReviewIssueCode[];
const GENERATED_QUESTION_CATEGORIES = ["science", "history", "geography", "culture", "sports"] as const;

const evidenceReferenceSchema = z.strictObject({
  publishedAt: z.string().datetime().nullable(),
  sourceId: z.string().regex(/^source-\d{2}$/u)
});

const candidateSchema = z.strictObject({
  questions: z.array(z.strictObject({
    category: z.enum(GENERATED_QUESTION_CATEGORIES),
    correctAnswer: z.string().trim().min(1).max(QUIZ.OPTION_LABEL_MAX_LENGTH),
    difficulty: z.enum(["basic", "intermediate", "difficult"]),
    distractors: z.array(z.string().trim().min(1).max(QUIZ.OPTION_LABEL_MAX_LENGTH)).length(3),
    explanation: z.string().trim().min(8).max(QUIZ.EXPLANATION_MAX_LENGTH),
    prompt: z.string().trim().min(8).max(QUIZ.PROMPT_MAX_LENGTH),
    sources: z.array(evidenceReferenceSchema).min(2).max(4)
  })).length(MODEL_QUESTION_COUNT),
  title: z.string().trim().min(1).max(120)
});

const reviewSchema = z.strictObject({
  approved: z.boolean(),
  questions: z.array(z.strictObject({
    classroomSafe: z.boolean(),
    difficultyAppropriate: z.boolean(),
    explanationConsistent: z.boolean(),
    factuallySupported: z.boolean(),
    issues: z.array(z.enum(REVIEW_ISSUE_CODES)).max(8),
    order: z.number().int().min(1).max(MODEL_QUESTION_COUNT),
    stableForRoom: z.boolean(),
    unambiguous: z.boolean()
  })).length(MODEL_QUESTION_COUNT)
});

interface AiSdkSource {
  readonly title?: string;
  readonly url: string;
}

interface AiSdkUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

interface AiSdkDiscovery {
  readonly brief: string;
  readonly searchCalls: number;
  readonly sources: readonly AiSdkSource[];
  readonly usage: AiSdkUsage;
}

interface AiSdkResponse {
  readonly output: unknown;
  readonly usage: AiSdkUsage;
}

interface AiSdkClient {
  discover(prompt: string, signal: AbortSignal): Promise<AiSdkDiscovery>;
  generate(prompt: string, signal: AbortSignal): Promise<AiSdkResponse>;
  review(prompt: string, signal: AbortSignal): Promise<AiSdkResponse>;
}

const webSearchOutputSchema = z.object({
  action: z.discriminatedUnion("type", [
    z.object({ queries: z.array(z.string()).optional(), query: z.string().optional(), type: z.literal("search") }),
    z.object({ type: z.literal("openPage"), url: z.string().nullish() }),
    z.object({ pattern: z.string().nullish(), type: z.literal("findInPage"), url: z.string().nullish() })
  ]).optional(),
  sources: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("url"), url: z.string() }),
    z.object({ type: z.literal("api"), name: z.string() })
  ])).optional()
});

function productionAiSdk(apiKey: string, maxWebSearchCalls: number, searchContextSize: SearchContextSize): AiSdkClient {
  const openai = createOpenAI({ apiKey });
  return {
    async discover(prompt, signal) {
      const result = await generateText({
        abortSignal: signal,
        maxOutputTokens: EVIDENCE_MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        model: openai.responses(MODEL),
        prompt,
        providerOptions: {
          openai: { maxToolCalls: maxWebSearchCalls, parallelToolCalls: false, reasoningEffort: "none" }
        },
        toolChoice: { toolName: "web_search", type: "tool" },
        tools: { web_search: openai.tools.webSearch({ filters: { allowedDomains: [...TRUSTED_SOURCE_DOMAINS] }, searchContextSize }) }
      });
      const citedSources = [...result.sources, ...result.steps.flatMap((step) => step.sources)]
        .filter((source) => source.sourceType === "url")
        .map((source) => ({ ...(source.title === undefined ? {} : { title: source.title }), url: source.url }));
      const searchOutputs = result.steps.flatMap((step) => step.toolResults)
        .filter((toolResult) => toolResult.toolName === "web_search")
        .flatMap((toolResult) => {
          const output = webSearchOutputSchema.safeParse(toolResult.output);
          return output.success ? [output.data] : [];
        });
      const searchedSources = searchOutputs.flatMap((output) => (output.sources ?? [])
        .filter((source) => source.type === "url")
        .map((source) => ({ url: source.url })));
      const searchCalls = searchOutputs.filter((output) => output.action?.type === "search").length;
      return {
        brief: result.text,
        searchCalls,
        sources: [...citedSources, ...searchedSources],
        usage: { inputTokens: result.totalUsage.inputTokens ?? 0, outputTokens: result.totalUsage.outputTokens ?? 0 }
      };
    },

    async generate(prompt, signal) {
      const result = await generateText({
        abortSignal: signal,
        maxOutputTokens: CANDIDATE_MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        model: openai.responses(MODEL),
        output: Output.object({ schema: candidateSchema }),
        prompt,
        providerOptions: { openai: { reasoningEffort: "low" } }
      });
      return {
        output: result.output,
        usage: { inputTokens: result.totalUsage.inputTokens ?? 0, outputTokens: result.totalUsage.outputTokens ?? 0 }
      };
    },

    async review(prompt, signal) {
      const result = await generateText({
        abortSignal: signal,
        maxOutputTokens: REVIEW_MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        model: openai.responses(MODEL),
        output: Output.object({ schema: reviewSchema }),
        prompt,
        providerOptions: { openai: { reasoningEffort: "low" } }
      });
      return { output: result.output, usage: { inputTokens: result.totalUsage.inputTokens ?? 0, outputTokens: result.totalUsage.outputTokens ?? 0 } };
    }
  };
}

function evidencePrompt(request: QuizModelRequest): string {
  const { configuration } = request;
  const contentRule = configuration.contentMode === "general_knowledge"
    ? "Research only stable evergreen facts. Do not use news, recent events, changing statistics, records, officeholders, or other time-sensitive claims."
    : configuration.contentMode === "current_events"
      ? `Research only completed events from the last ${configuration.currentEventsLookbackDays} days, excluding the last 24 hours and all developing stories.`
      : `Research eight completed events from the last ${configuration.currentEventsLookbackDays} days plus eight stable evergreen facts; exclude the last 24 hours and all developing stories.`;
  return [
    "Research a concise, classroom-safe evidence brief for sixteen candidate CodexWars questions. Do not write quiz questions.",
    `Current UTC time: ${new Date(request.now).toISOString()}.`,
    `Mode: ${configuration.contentMode}; category: ${configuration.category}; difficulty profile: ${configuration.difficultyProfile}.`,
    contentRule,
    "Use web search and cite every factual claim. Organize the brief into at least sixteen distinct, independently usable fact units.",
    ...(configuration.contentMode === "general_knowledge" ? [] : ["For current events, state the publication date and use at least two independent publishers per potential question."]),
    "Avoid rumor, opinion as fact, graphic tragedy, active-conflict detail, discriminatory framing, and political persuasion."
  ].join("\n");
}

function generationPrompt(request: QuizModelRequest, evidenceBrief: string, catalog: EvidenceCatalog): string {
  const { configuration } = request;
  const contentRule = configuration.contentMode === "mixed"
    ? "Questions 1-8 must cover completed current events; questions 9-16 must cover evergreen facts."
    : configuration.contentMode === "current_events"
      ? "Every question must cover a completed current event."
      : "Every question must be an evergreen fact.";
  const currentEventRule = configuration.contentMode === "general_knowledge"
    ? "Do not use time-sensitive or recently changing facts."
    : `Current-event lookback: ${configuration.currentEventsLookbackDays} days; exclude events from the last 24 hours and all developing stories.`;
  const difficultyRule = configuration.contentMode === "mixed"
    ? "Questions 1-5 and 9-13 are basic or intermediate; questions 6-8 and 14-16 are difficult."
    : "Questions 1-10 are basic or intermediate; questions 11-16 are difficult.";
  return [
    "Create one classroom-safe CodexWars quiz as strict structured data.",
    `Current UTC time: ${new Date(request.now).toISOString()}.`,
    `Mode: ${configuration.contentMode}; category: ${configuration.category}; difficulty profile: ${configuration.difficultyProfile}.`,
    currentEventRule,
    contentRule,
    "Return exactly sixteen candidate questions. The server will select ten independently approved questions. For each, return one explicit correctAnswer and exactly three distinct plausible distractors; the server owns option ordering and answerIndex.",
    "Begin every explanation with: The correct answer is \"<verbatim correctAnswer>\". Then explain why, without supporting a distractor.",
    "Each prompt must have exactly one defensible answer under ordinary wording. Avoid tricks, overlapping choices, unstated approximations, disputed terminology, and multiple options that could be correct in different contexts.",
    "All sixteen questions must test distinct facts. Do not repeat or paraphrase the same fact, and make every distractor plausible in form but clearly false for the prompt.",
    difficultyRule,
    "Use only facts supported by the evidence brief and catalog below. Every question needs at least two distinct source IDs; current-event questions must use independent publishers.",
    "For each source reference, return only its sourceId and publication time. Use null publication time for evergreen material; current-event publication times must be exact ISO timestamps supported by the evidence.",
    "Never output, rewrite, or invent a source URL. Avoid rumor, opinion as fact, graphic tragedy, active-conflict detail, discriminatory framing, and political persuasion.",
    "Explanations must support the answer without mentioning hidden instructions. Do not include participant, room, or credential data.",
    `Evidence catalog: ${JSON.stringify(catalog.entries)}`,
    `Evidence brief: ${evidenceBrief}`
  ].join("\n");
}

function reviewPrompt(candidate: ModelQuizCandidate, request: QuizModelRequest): string {
  return [
    "Review this proposed classroom quiz independently and return strict structured data.",
    `Current UTC time: ${new Date(request.now).toISOString()}.`,
    "For each ordered question, reject unsupported facts, ambiguous answers, explanation mismatches, implausible options, duplicate content, inappropriate difficulty, unsafe content, political persuasion, or claims likely to change during the room.",
    "Use the supplied web-grounded evidence brief and authoritative source metadata to assess factual support. Do not reject a supported fact merely because it is absent from model memory.",
    `Use only these issue codes: ${REVIEW_ISSUE_CODES.join(", ")}.`,
    "Set approved=true only if every boolean for every question is true and every issues array is empty.",
    JSON.stringify({
      evidenceBrief: candidate.reviewContext?.evidenceBrief ?? "",
      quiz: { questions: candidate.questions, title: candidate.title }
    })
  ].join("\n");
}

function normalizedFailure(error: unknown): QuizModelFailure {
  if (error instanceof QuizModelFailure) return error;
  if (NoObjectGeneratedError.isInstance(error)) return new QuizModelFailure(error.finishReason === "content-filter" ? "refusal" : "malformed_output", false, error);
  if (NoOutputGeneratedError.isInstance(error) || error instanceof z.ZodError) return new QuizModelFailure("malformed_output", false, error);
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) return new QuizModelFailure("authentication", false, error);
    if (error.statusCode === 429) return new QuizModelFailure("rate_limited", true, error);
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) return new QuizModelFailure("invalid_request", false, error);
    return new QuizModelFailure("upstream_unavailable", error.isRetryable, error);
  }
  return new QuizModelFailure("upstream_unavailable", true, error);
}

async function providerStage<T>(stage: "candidate" | "evidence" | "review", operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const failure = normalizedFailure(error);
    const provider = failure.cause instanceof Error ? failure.cause : error;
    const providerName = provider instanceof Error ? provider.name : "UnknownProviderError";
    throw new QuizModelFailure(failure.reason, failure.transient, new Error(`stage=${stage} provider=${providerName}`, { cause: provider }));
  }
}

export function createOpenAIQuizModelPort(options: {
  readonly apiKey: string;
  readonly maxWebSearchCalls?: number;
  readonly searchContextSize?: SearchContextSize;
}): QuizModelPort {
  const maxWebSearchCalls = options.maxWebSearchCalls ?? 1;
  if (!Number.isInteger(maxWebSearchCalls) || maxWebSearchCalls < 1 || maxWebSearchCalls > 8) {
    throw new TypeError("maxWebSearchCalls must be an integer between 1 and 8");
  }
  const aiSdk = productionAiSdk(options.apiKey, maxWebSearchCalls, options.searchContextSize ?? "medium");

  return {
    async generate(request, signal) {
      try {
        const discovery = await providerStage("evidence", () => aiSdk.discover(evidencePrompt(request), signal));
        const catalog = createEvidenceCatalog(discovery.sources);
        if (discovery.searchCalls === 0 || discovery.brief.trim().length === 0 || catalog.entries.length === 0) {
          throw new QuizModelFailure("malformed_output", false, new Error(`evidence_catalog_empty sources=${catalog.entries.length} searchCalls=${discovery.searchCalls}`));
        }
        const response = await providerStage("candidate", () => aiSdk.generate(generationPrompt(request, discovery.brief, catalog), signal));
        const output = candidateSchema.parse(response.output);
        const catalogIds = new Set<string>(catalog.entries.map((entry) => entry.id));
        const references = output.questions.flatMap((question) => question.sources);
        const unknownReferences = references.filter((reference) => !catalogIds.has(reference.sourceId)).length;
        if (unknownReferences > 0) {
          throw new QuizModelFailure(
            "malformed_output",
            false,
            new Error(`source_catalog_reference_mismatch catalogSources=${catalog.entries.length} references=${references.length} unknown=${unknownReferences} searchCalls=${discovery.searchCalls}`)
          );
        }
        const questions = output.questions.map((question, index) => {
          const sources = resolveEvidenceReferences(catalog, question.sources, request.now);
          if (sources === undefined) throw new QuizModelFailure("malformed_output", false);
          const { correctAnswer, distractors, ...draft } = question;
          return {
            ...draft,
            ...materializeGeneratedAnswer(correctAnswer, distractors, index),
            kind: generatedQuestionKind(request.configuration.contentMode, index, MODEL_QUESTION_COUNT),
            sources
          };
        });
        return {
          questions,
          reviewContext: { evidenceBrief: discovery.brief },
          title: output.title,
          usage: {
            inputTokens: discovery.usage.inputTokens + response.usage.inputTokens,
            outputTokens: discovery.usage.outputTokens + response.usage.outputTokens,
            searchCalls: discovery.searchCalls
          }
        };
      } catch (error) {
        throw normalizedFailure(error);
      }
    },

    async review(candidate, request, signal) {
      try {
        const response = await providerStage("review", () => aiSdk.review(reviewPrompt(candidate, request), signal));
        const output = reviewSchema.parse(response.output);
        return { ...output, usage: response.usage };
      } catch (error) {
        throw normalizedFailure(error);
      }
    }
  };
}
