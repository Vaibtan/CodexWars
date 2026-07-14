export interface MobileQuizQuestion {
  correctOptionId: string;
  durationMs: number;
  id: string;
  options: readonly { id: string; label: string }[];
  prompt: string;
  topic: string;
}

export const quizCatalog: readonly MobileQuizQuestion[] = [
  { id: "q01", topic: "VARIABLES", prompt: "let x = 3; x = x + 2; What is x?", options: [{ id: "a", label: "3" }, { id: "b", label: "5" }, { id: "c", label: "6" }, { id: "d", label: "error" }], correctOptionId: "b", durationMs: 30_000 },
  { id: "q02", topic: "TYPES", prompt: "What is the type of true?", options: [{ id: "a", label: "string" }, { id: "b", label: "number" }, { id: "c", label: "boolean" }, { id: "d", label: "object" }], correctOptionId: "c", durationMs: 30_000 },
  { id: "q03", topic: "CONDITIONS", prompt: "What does if (7 > 10) { A } else { B } select?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "both" }, { id: "d", label: "neither" }], correctOptionId: "b", durationMs: 30_000 },
  { id: "q04", topic: "LOOPS", prompt: "How many times does for (let i = 0; i < 4; i++) run?", options: [{ id: "a", label: "3" }, { id: "b", label: "4" }, { id: "c", label: "5" }, { id: "d", label: "infinitely" }], correctOptionId: "b", durationMs: 30_000 },
  { id: "q05", topic: "FUNCTIONS", prompt: "function triple(n) { return n * 3; } What is triple(4)?", options: [{ id: "a", label: "7" }, { id: "b", label: "12" }, { id: "c", label: "16" }, { id: "d", label: "undefined" }], correctOptionId: "b", durationMs: 30_000 },
  { id: "q06", topic: "ARRAYS", prompt: "Given const a = [10, 20, 30], what is a[1]?", options: [{ id: "a", label: "10" }, { id: "b", label: "20" }, { id: "c", label: "30" }, { id: "d", label: "undefined" }], correctOptionId: "b", durationMs: 30_000 },
  { id: "q07", topic: "OBJECTS", prompt: "const user = { name: 'Ada', level: 1 }; user.level = 2; What is user.name?", options: [{ id: "a", label: "Ada" }, { id: "b", label: "1" }, { id: "c", label: "2" }, { id: "d", label: "undefined" }], correctOptionId: "a", durationMs: 30_000 },
  { id: "q08", topic: "REFERENCES", prompt: "const a = { score: 1 }; const b = a; b.score = 4; What is a.score?", options: [{ id: "a", label: "1" }, { id: "b", label: "4" }, { id: "c", label: "undefined" }, { id: "d", label: "error" }], correctOptionId: "b", durationMs: 45_000 },
  { id: "q09", topic: "ALGORITHMS", prompt: "Two nested loops each run n times. What is the usual time complexity?", options: [{ id: "a", label: "O(1)" }, { id: "b", label: "O(n)" }, { id: "c", label: "O(n log n)" }, { id: "d", label: "O(n²)" }], correctOptionId: "d", durationMs: 45_000 },
  { id: "q10", topic: "SEARCH", prompt: "What must be true before using binary search correctly?", options: [{ id: "a", label: "The list is sorted" }, { id: "b", label: "The list has no duplicates" }, { id: "c", label: "The list is all numbers" }, { id: "d", label: "The list has exactly 10 items" }], correctOptionId: "a", durationMs: 45_000 },
] as const;

export function getQuizQuestion(questionId: string | null): MobileQuizQuestion | null {
  return quizCatalog.find((question) => question.id === questionId) ?? null;
}
