import { QUIZ } from "./constants.js";
import type { PublicQuizQuestion, QuizQuestion, QuizTemplate } from "./types.js";

const optionIds = ["a", "b", "c", "d"] as const;

function question(
  order: number,
  difficulty: QuizQuestion["difficulty"],
  prompt: string,
  labels: readonly [string, string, string, string],
  answerOptionId: (typeof optionIds)[number],
  explanation: string
): QuizQuestion {
  return {
    answerOptionId,
    difficulty,
    durationMs: difficulty === "difficult" ? QUIZ.DIFFICULT_QUESTION_MS : QUIZ.BASIC_QUESTION_MS,
    explanation,
    id: `pf-${String(order).padStart(2, "0")}`,
    options: optionIds.map((id, index) => ({ id, label: labels[index] })),
    order,
    prompt
  };
}

export const PROGRAMMING_FUNDAMENTALS_V1: QuizTemplate = {
  id: QUIZ.TEMPLATE_ID,
  questions: [
    question(1, "basic", "let x = 3; x = x + 2; What is x?", ["3", "5", "6", "error"], "b", "The assignment replaces the old value with 3 + 2."),
    question(2, "basic", "What is the type of true?", ["string", "number", "boolean", "object"], "c", "true and false are boolean values."),
    question(3, "basic", "What does if (7 > 10) { \"A\" } else { \"B\" } select?", ["A", "B", "both", "neither"], "b", "7 > 10 is false, so the else branch runs."),
    question(4, "basic", "How many times does for (let i = 0; i < 4; i++) run?", ["3", "4", "5", "infinitely"], "b", "It runs for i = 0, 1, 2, 3."),
    question(5, "basic", "function triple(n) { return n * 3; } What is triple(4)?", ["7", "12", "16", "undefined"], "b", "The function returns its input multiplied by three."),
    question(6, "intermediate", "Given const a = [10, 20, 30], what is a[1]?", ["10", "20", "30", "undefined"], "b", "Array indexes begin at zero."),
    question(7, "intermediate", "const user = { name: \"Ada\", level: 1 }; user.level = 2; What is user.name?", ["Ada", "1", "2", "undefined"], "a", "Updating one property does not change another."),
    question(8, "difficult", "const a = { score: 1 }; const b = a; b.score = 4; What is a.score?", ["1", "4", "undefined", "error"], "b", "Both variables refer to the same object."),
    question(9, "difficult", "A loop runs n times and contains another loop that also runs n times. What is the usual time complexity?", ["O(1)", "O(n)", "O(n log n)", "O(n²)"], "d", "The body executes roughly n × n times."),
    question(10, "difficult", "What must be true before using binary search correctly?", ["list is sorted", "no duplicates", "all numbers", "exactly 10 items"], "a", "Binary search discards half based on ordering.")
  ]
};

export type QuizTemplateValidation = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export function validateQuizTemplate(template: QuizTemplate): QuizTemplateValidation {
  if (template.id !== QUIZ.TEMPLATE_ID || template.questions.length !== QUIZ.QUESTION_COUNT) {
    return { ok: false, reason: "template must contain the approved ten questions" };
  }

  const ids = new Set<string>();
  for (const [index, quizQuestion] of template.questions.entries()) {
    if (ids.has(quizQuestion.id) || quizQuestion.order !== index + 1) {
      return { ok: false, reason: "question IDs and order must be unique and sequential" };
    }
    ids.add(quizQuestion.id);

    const expectedDuration = quizQuestion.difficulty === "difficult" ? QUIZ.DIFFICULT_QUESTION_MS : QUIZ.BASIC_QUESTION_MS;
    if (quizQuestion.options.length !== 4 || quizQuestion.durationMs !== expectedDuration) {
      return { ok: false, reason: "questions must have four options and their approved duration" };
    }
    const idsForQuestion = new Set(quizQuestion.options.map((option) => option.id));
    if (idsForQuestion.size !== 4 || !idsForQuestion.has(quizQuestion.answerOptionId)) {
      return { ok: false, reason: "questions must have distinct options and a valid answer" };
    }
  }
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
