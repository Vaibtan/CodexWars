import { QUIZ } from "./constants.js";
import type { PublicQuizQuestion, QuizQuestion, QuizTemplate } from "./types.js";

const OPTION_IDS = ["a", "b", "c", "d"] as const;
const TEMPLATE_ID_PATTERN = /^(?:fallback|generated):[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u;

function question(
  order: number,
  difficulty: QuizQuestion["difficulty"],
  prompt: string,
  labels: readonly [string, string, string, string],
  answerOptionId: (typeof OPTION_IDS)[number],
  explanation: string
): QuizQuestion {
  return {
    answerOptionId,
    difficulty,
    durationMs: difficulty === "difficult" ? QUIZ.DIFFICULT_QUESTION_MS : QUIZ.BASIC_QUESTION_MS,
    explanation,
    id: `gk-${String(order).padStart(2, "0")}`,
    options: OPTION_IDS.map((id, index) => ({ id, label: labels[index] })),
    order,
    prompt
  };
}

export const GENERAL_KNOWLEDGE_FALLBACK_V1: QuizTemplate = {
  id: QUIZ.FALLBACK_TEMPLATE_ID,
  questions: [
    question(1, "basic", "Which is the largest ocean on Earth?", ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], "a", "The Pacific Ocean covers more area than any other ocean."),
    question(2, "basic", "Which gas do plants absorb from the atmosphere during photosynthesis?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], "c", "Plants use carbon dioxide, water, and light energy during photosynthesis."),
    question(3, "basic", "What is the capital city of Japan?", ["Kyoto", "Tokyo", "Osaka", "Sapporo"], "b", "Tokyo is the capital and largest metropolitan area of Japan."),
    question(4, "basic", "Who wrote the novel Pride and Prejudice?", ["Jane Austen", "Mary Shelley", "George Eliot", "Virginia Woolf"], "a", "Jane Austen published Pride and Prejudice in 1813."),
    question(5, "intermediate", "Which river was central to the development of ancient Egyptian civilization?", ["Amazon", "Danube", "Nile", "Yangtze"], "c", "The Nile supplied water and fertile soil that supported ancient Egyptian settlements."),
    question(6, "intermediate", "What is the chemical symbol for gold?", ["Ag", "Au", "Gd", "Go"], "b", "Gold uses the symbol Au, derived from the Latin word aurum."),
    question(7, "intermediate", "Which country is home to the historic site of Machu Picchu?", ["Mexico", "Peru", "Chile", "Bolivia"], "b", "Machu Picchu is an Inca site in present-day Peru."),
    question(8, "difficult", "Which element has atomic number 1?", ["Helium", "Hydrogen", "Lithium", "Oxygen"], "b", "Hydrogen has one proton and is the first element in the periodic table."),
    question(9, "difficult", "Which planet is the largest in our Solar System?", ["Saturn", "Neptune", "Earth", "Jupiter"], "d", "Jupiter has the greatest mass and diameter of any planet in the Solar System."),
    question(10, "difficult", "Which is the longest continental mountain range on Earth?", ["Himalayas", "Rocky Mountains", "Andes", "Alps"], "c", "The Andes extend along the western edge of South America for roughly 7,000 kilometres.")
  ]
};

export type QuizTemplateValidation = { readonly ok: true } | { readonly ok: false; readonly reason: string };

function normalized(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

function semanticNormalized(value: string): string {
  return normalized(value).replace(/[\p{P}\p{S}]/gu, "").replace(/\s+/gu, " ").trim();
}

function hasBoundedText(value: string, maximum: number, minimum = 1): boolean {
  const length = [...value.normalize("NFKC").trim()].length;
  return length >= minimum && length <= maximum && !/[\p{Cc}\p{Cf}]/u.test(value);
}

export function validateQuizTemplate(template: QuizTemplate): QuizTemplateValidation {
  if (!TEMPLATE_ID_PATTERN.test(template.id) || template.id.length > QUIZ.TEMPLATE_ID_MAX_LENGTH) {
    return { ok: false, reason: "template ID must be a bounded server-generated identifier" };
  }
  if (template.questions.length !== QUIZ.QUESTION_COUNT) {
    return { ok: false, reason: "template must contain exactly ten questions" };
  }

  const questionIds = new Set<string>();
  const prompts = new Set<string>();
  let difficultQuestions = 0;
  for (const [index, quizQuestion] of template.questions.entries()) {
    if (!hasBoundedText(quizQuestion.id, 64) || questionIds.has(quizQuestion.id) || quizQuestion.order !== index + 1) {
      return { ok: false, reason: "question IDs and order must be unique and sequential" };
    }
    questionIds.add(quizQuestion.id);

    if (!hasBoundedText(quizQuestion.prompt, QUIZ.PROMPT_MAX_LENGTH, 8) || prompts.has(normalized(quizQuestion.prompt))) {
      return { ok: false, reason: "question prompts must be bounded and distinct" };
    }
    prompts.add(normalized(quizQuestion.prompt));
    if (!hasBoundedText(quizQuestion.explanation, QUIZ.EXPLANATION_MAX_LENGTH, 8)) {
      return { ok: false, reason: "question explanations must be bounded" };
    }

    const expectedDuration = quizQuestion.difficulty === "difficult" ? QUIZ.DIFFICULT_QUESTION_MS : QUIZ.BASIC_QUESTION_MS;
    if (quizQuestion.options.length !== OPTION_IDS.length || quizQuestion.durationMs !== expectedDuration) {
      return { ok: false, reason: "questions must have four options and their approved duration" };
    }
    if (quizQuestion.difficulty === "difficult") difficultQuestions += 1;

    const optionIdSet = new Set(quizQuestion.options.map((option) => option.id));
    if (OPTION_IDS.some((id) => !optionIdSet.has(id)) || !optionIdSet.has(quizQuestion.answerOptionId)) {
      return { ok: false, reason: "questions must use four canonical options and a valid answer" };
    }
    if (quizQuestion.options.some((option) => !hasBoundedText(option.label, QUIZ.OPTION_LABEL_MAX_LENGTH))) {
      return { ok: false, reason: "question option labels must be bounded" };
    }
    const labels = new Set(quizQuestion.options.map((option) => semanticNormalized(option.label)));
    if (labels.size !== OPTION_IDS.length) {
      return { ok: false, reason: "question option labels must be distinct" };
    }
  }

  if (difficultQuestions !== 3) return { ok: false, reason: "template must contain exactly three difficult questions" };
  return { ok: true };
}

export function publicQuizQuestion(quizQuestion: QuizQuestion): PublicQuizQuestion {
  return {
    difficulty: quizQuestion.difficulty,
    durationMs: quizQuestion.durationMs,
    id: quizQuestion.id,
    options: quizQuestion.options.map((option) => ({ ...option })),
    order: quizQuestion.order,
    prompt: quizQuestion.prompt
  };
}

export function startingShieldForScore(correctAnswers: number): number {
  if (!Number.isInteger(correctAnswers) || correctAnswers < 0 || correctAnswers > QUIZ.QUESTION_COUNT) {
    throw new RangeError("correctAnswers must be an integer from 0 to 10");
  }
  if (correctAnswers <= 2) return 0;
  if (correctAnswers <= 4) return 10;
  if (correctAnswers <= 6) return 20;
  if (correctAnswers <= 8) return 30;
  return 40;
}
