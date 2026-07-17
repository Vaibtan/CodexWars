const LOCKED_MODEL = "gpt-5.4-mini-2026-03-17" as const;

export type GenerationCapability = "fallback_only" | "generated";

export interface ServerConfig {
  readonly admission: {
    readonly generationPerHour: number;
    readonly joinsPerMinute: number;
    readonly roomsPerHour: number;
  };
  readonly port: number;
  readonly trustProxy: boolean;
  readonly generation: {
    readonly capability: GenerationCapability;
    readonly circuitCooldownMs: number;
    readonly circuitFailureThreshold: number;
    readonly dailyGenerationLimit: number;
    readonly dailySearchLimit: number;
    readonly developingStoryCutoffMs: number;
    readonly enabled: boolean;
    readonly maxConcurrent: number;
    readonly maxRegenerationsPerRound: number;
    readonly model: typeof LOCKED_MODEL;
    readonly openaiApiKey?: string;
    readonly retryLimit: number;
    readonly timeoutMs: number;
  };
}

type Environment = Readonly<Record<string, string | undefined>>;

function integer(env: Environment, name: string, fallback: number, minimum: number): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new TypeError(`${name} must be an integer >= ${minimum}`);
  return parsed;
}

function flag(env: Environment, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new TypeError(`${name} must be true or false`);
}

export function loadServerConfig(env: Environment): ServerConfig {
  const requestedModel = env.OPENAI_MODEL ?? LOCKED_MODEL;
  if (requestedModel !== LOCKED_MODEL) throw new TypeError(`OPENAI_MODEL must be ${LOCKED_MODEL}`);
  const requestedGeneration = flag(env, "QUIZ_GENERATION_ENABLED", true);
  const openaiApiKey = env.OPENAI_API_KEY?.trim() || undefined;
  const enabled = requestedGeneration && openaiApiKey !== undefined;

  return {
    admission: {
      generationPerHour: integer(env, "ADMISSION_GENERATION_PER_IP_PER_HOUR", 100, 0),
      joinsPerMinute: integer(env, "ADMISSION_JOINS_PER_IP_PER_MINUTE", 600, 0),
      roomsPerHour: integer(env, "ADMISSION_ROOMS_PER_IP_PER_HOUR", 100, 0)
    },
    generation: {
      capability: enabled ? "generated" : "fallback_only",
      circuitCooldownMs: integer(env, "QUIZ_CIRCUIT_COOLDOWN_MS", 60_000, 1),
      circuitFailureThreshold: integer(env, "QUIZ_CIRCUIT_FAILURE_THRESHOLD", 3, 1),
      dailyGenerationLimit: integer(env, "QUIZ_DAILY_GENERATION_LIMIT", 500, 0),
      dailySearchLimit: integer(env, "QUIZ_DAILY_SEARCH_LIMIT", 2_000, 0),
      developingStoryCutoffMs: integer(env, "QUIZ_DEVELOPING_STORY_CUTOFF_MS", 3_600_000, 1),
      enabled,
      maxConcurrent: integer(env, "QUIZ_MAX_CONCURRENT_GENERATIONS", 2, 1),
      maxRegenerationsPerRound: integer(env, "QUIZ_MAX_REGENERATIONS_PER_ROUND", 2, 0),
      model: LOCKED_MODEL,
      ...(openaiApiKey === undefined ? {} : { openaiApiKey }),
      retryLimit: integer(env, "QUIZ_GENERATION_RETRY_LIMIT", 1, 0),
      timeoutMs: integer(env, "QUIZ_PREPARATION_TIMEOUT_MS", 20_000, 1)
    },
    port: integer(env, "PORT", 4000, 1),
    trustProxy: flag(env, "TRUST_PROXY", false)
  };
}

export const serverConfig = loadServerConfig(process.env);
