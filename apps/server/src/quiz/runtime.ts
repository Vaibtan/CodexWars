import { randomUUID } from "node:crypto";
import type { ServerConfig } from "../config.js";
import { createGenerationGovernor } from "./governor.js";
import { createOpenAIQuizModelPort } from "./openai-quiz-model.js";
import { createQuizPreparation } from "./quiz-preparation.js";
import type { QuizPreparation } from "./types.js";

export function createRuntimeQuizPreparation(config: ServerConfig, now: () => number = Date.now): QuizPreparation {
  const governor = createGenerationGovernor({
    dailyGenerationLimit: config.generation.dailyGenerationLimit,
    dailySearchLimit: config.generation.dailySearchLimit,
    maxConcurrent: config.generation.maxConcurrent
  });
  const model = config.generation.enabled && config.generation.openaiApiKey !== undefined
    ? createOpenAIQuizModelPort({ apiKey: config.generation.openaiApiKey })
    : undefined;
  return createQuizPreparation({
    governor,
    id: randomUUID,
    model,
    now,
    policy: {
      circuitCooldownMs: config.generation.circuitCooldownMs,
      circuitFailureThreshold: config.generation.circuitFailureThreshold,
      deadlineMs: config.generation.timeoutMs,
      developingStoryCutoffMs: config.generation.developingStoryCutoffMs,
      retryLimit: config.generation.retryLimit
    }
  });
}
