export type QuizDifficulty = "basic" | "intermediate" | "difficult";

export type QuizOption = {
  id: string;
  label: string;
};

export type QuizQuestion = {
  id: string;
  order: number;
  prompt: string;
  options: readonly QuizOption[];
  correctOptionId: string;
  explanation: string;
  difficulty: QuizDifficulty;
  durationMs: number;
};

export type QuizTemplate = {
  id: string;
  version: number;
  title: string;
  questions: readonly QuizQuestion[];
};

export type QuizSession = {
  id: string;
  organizerUid: string;
  templateId: string;
  templateVersion: number;
};

export type QuizAnswer = {
  questionId: string;
  optionId: string;
};
