import { QUIZ, publicQuizQuestion, validateQuizTemplate, type QuizConfiguration, type QuizEvidenceSource, type QuizQuestion, type QuizTemplate } from "@codexwars/shared";
import type { ModelEvidenceSource, ModelQuizCandidate, ModelQuizReview } from "./types.js";

const OPTION_IDS = ["a", "b", "c", "d"] as const;
const BLOCKED_SOURCE_DOMAINS = ["facebook.com", "instagram.com", "reddit.com", "tiktok.com", "x.com"] as const;
export const TRUSTED_SOURCE_DOMAINS = [
  "apnews.com", "bbc.com", "britannica.com", "fifa.com", "history.com", "nasa.gov", "nationalgeographic.com",
  "nih.gov", "noaa.gov", "npr.org", "olympics.com", "reuters.com", "si.edu", "un.org", "who.int", "worldbank.org"
] as const;
const UNSAFE_TERMS = ["graphic violence", "racial slur", "suicide method", "targeted political persuasion"] as const;

export type CandidateValidation =
  | { readonly ok: true; readonly sources: readonly QuizEvidenceSource[]; readonly template: QuizTemplate }
  | { readonly ok: false };

export function generatedQuestionKind(
  contentMode: QuizConfiguration["contentMode"],
  index: number,
  questionCount: number = QUIZ.QUESTION_COUNT
): ModelQuizCandidate["questions"][number]["kind"] {
  if (contentMode === "general_knowledge") return "evergreen";
  if (contentMode === "current_events") return "current_event";
  return index < questionCount / 2 ? "current_event" : "evergreen";
}

export function materializeGeneratedAnswer(
  correctAnswer: string,
  distractors: readonly string[],
  index: number
): Pick<ModelQuizCandidate["questions"][number], "answerIndex" | "options"> {
  const answerIndex = index % OPTION_IDS.length;
  const options = [...distractors];
  options.splice(answerIndex, 0, correctAnswer);
  return { answerIndex, options };
}

function hostname(source: ModelEvidenceSource): string | undefined {
  try {
    const parsed = new URL(source.url);
    return parsed.protocol === "https:" ? parsed.hostname.toLocaleLowerCase("en").replace(/^www\./u, "") : undefined;
  } catch {
    return undefined;
  }
}

function sourceAllowed(source: ModelEvidenceSource, currentEvent: boolean, configuration: QuizConfiguration, now: number, cutoffMs: number): boolean {
  const domain = hostname(source);
  if (domain === undefined || BLOCKED_SOURCE_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) return false;
  if (!TRUSTED_SOURCE_DOMAINS.some((trusted) => domain === trusted || domain.endsWith(`.${trusted}`))) return false;
  const titleLength = [...source.title.normalize("NFKC").trim()].length;
  const publisherLength = [...source.publisher.normalize("NFKC").trim()].length;
  if (!Number.isFinite(source.retrievedAt) || source.retrievedAt > now || titleLength === 0 || titleLength > 200 || publisherLength === 0 || publisherLength > 100 || source.url.length > 500) return false;
  if (!currentEvent) return true;
  if (source.publishedAt === undefined) return false;
  const publishedAt = Date.parse(source.publishedAt);
  const age = now - publishedAt;
  return Number.isFinite(publishedAt) && age >= cutoffMs && age <= configuration.currentEventsLookbackDays * 86_400_000;
}

function evidenceAllowed(sources: readonly ModelEvidenceSource[], currentEvent: boolean, configuration: QuizConfiguration, now: number, cutoffMs: number): boolean {
  const required = currentEvent ? 2 : 1;
  if (sources.length < required || sources.some((source) => !sourceAllowed(source, currentEvent, configuration, now, cutoffMs))) return false;
  const domains = new Set(sources.map(hostname));
  return domains.size >= required;
}

function contentModeAllowed(candidate: ModelQuizCandidate, configuration: QuizConfiguration): boolean {
  const currentEvents = candidate.questions.filter((question) => question.kind === "current_event").length;
  if (configuration.contentMode === "general_knowledge") return currentEvents === 0;
  if (configuration.contentMode === "current_events") return currentEvents === QUIZ.QUESTION_COUNT;
  return currentEvents === QUIZ.QUESTION_COUNT / 2;
}

function questionReviewApproved(question: ModelQuizReview["questions"][number]): boolean {
  return question.classroomSafe
    && question.difficultyAppropriate
    && question.explanationConsistent
    && question.factuallySupported
    && question.stableForRoom
    && question.unambiguous
    && question.issues.length === 0;
}

function reviewApproved(review: ModelQuizReview): boolean {
  return review.approved
    && review.questions.length === QUIZ.QUESTION_COUNT
    && review.questions.every((question, index) => question.order === index + 1
      && questionReviewApproved(question));
}

function combinations<T>(values: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  return values.flatMap((value, index) => combinations(values.slice(index + 1), size - 1).map((tail) => [value, ...tail]));
}

export function selectPlayableCandidate(
  candidate: ModelQuizCandidate,
  review: ModelQuizReview,
  configuration: QuizConfiguration
): { readonly candidate: ModelQuizCandidate; readonly review: ModelQuizReview } | undefined {
  const reviewsByOrder = new Map(review.questions.map((question) => [question.order, question]));
  const approved = candidate.questions.flatMap((question, index) => {
    const questionReview = reviewsByOrder.get(index + 1);
    return questionReview !== undefined && questionReviewApproved(questionReview) ? [{ question, review: questionReview }] : [];
  });
  const selected = combinations(approved, QUIZ.QUESTION_COUNT).find((selection) => {
    const difficult = selection.filter(({ question }) => question.difficulty === "difficult").length;
    const currentEvents = selection.filter(({ question }) => question.kind === "current_event").length;
    return difficult === 3 && (configuration.contentMode !== "mixed" || currentEvents === QUIZ.QUESTION_COUNT / 2);
  });
  if (selected === undefined) return undefined;
  const ordered = [...selected].sort(({ question: left }, { question: right }) => Number(left.difficulty === "difficult") - Number(right.difficulty === "difficult"));
  return {
    candidate: { ...candidate, questions: ordered.map(({ question }) => question) },
    review: {
      approved: true,
      questions: ordered.map(({ review: questionReview }, index) => ({ ...questionReview, order: index + 1 })),
      ...(review.usage === undefined ? {} : { usage: review.usage })
    }
  };
}

function questionFromModel(question: ModelQuizCandidate["questions"][number], order: number): QuizQuestion | undefined {
  if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= OPTION_IDS.length || question.options.length !== OPTION_IDS.length) return undefined;
  return {
    answerOptionId: OPTION_IDS[question.answerIndex]!,
    difficulty: question.difficulty,
    durationMs: question.difficulty === "difficult" ? QUIZ.DIFFICULT_QUESTION_MS : QUIZ.BASIC_QUESTION_MS,
    explanation: question.explanation,
    id: `q-${String(order).padStart(2, "0")}`,
    options: OPTION_IDS.map((id, index) => ({ id, label: question.options[index]! })),
    order,
    prompt: question.prompt
  };
}

export function validateGeneratedCandidate(candidate: ModelQuizCandidate, review: ModelQuizReview, configuration: QuizConfiguration, now: number, cutoffMs: number, templateId: string): CandidateValidation {
  if (candidate.questions.length !== QUIZ.QUESTION_COUNT || !contentModeAllowed(candidate, configuration) || !reviewApproved(review)) return { ok: false };
  const unsafeText = candidate.questions.flatMap((question) => [question.prompt, question.explanation]).join(" ").toLocaleLowerCase("en");
  if (UNSAFE_TERMS.some((term) => unsafeText.includes(term))) return { ok: false };
  if (configuration.category !== "mixed" && candidate.questions.some((question) => question.category !== configuration.category)) return { ok: false };
  if (candidate.questions.some((question) => !evidenceAllowed(question.sources, question.kind === "current_event", configuration, now, cutoffMs))) return { ok: false };

  const questions = candidate.questions.map((question, index) => questionFromModel(question, index + 1));
  if (questions.some((question) => question === undefined)) return { ok: false };
  const template: QuizTemplate = { id: templateId, questions: questions as readonly QuizQuestion[] };
  if (!validateQuizTemplate(template).ok) return { ok: false };

  const uniqueSources = new Map<string, QuizEvidenceSource>();
  for (const source of candidate.questions.flatMap((question) => question.sources)) {
    uniqueSources.set(source.url, {
      ...(source.publishedAt === undefined ? {} : { publishedAt: source.publishedAt }),
      publisher: source.publisher,
      title: source.title,
      url: source.url
    });
  }
  return { ok: true, sources: [...uniqueSources.values()], template };
}

export function previewQuestions(template: QuizTemplate) {
  return template.questions.map(publicQuizQuestion);
}
