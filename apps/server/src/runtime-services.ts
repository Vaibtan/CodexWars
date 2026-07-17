import { randomUUID } from "node:crypto";
import { createAdmissionControl } from "./admission-control.js";
import { serverConfig } from "./config.js";
import { createGenerationGovernor, createOpenAIQuizModelPort, createQuizPreparation, createQuizTelemetry } from "./quiz/index.js";
import type { WarRoomDependencies } from "./rooms/war-room.js";
import { RoomIdAllocator } from "./rooms/room-id.js";

export const productionAdmission = createAdmissionControl(serverConfig.admission);
const traffic = { accepting: true };
const generationGovernor = createGenerationGovernor({
  dailyGenerationLimit: serverConfig.generation.dailyGenerationLimit,
  dailySearchLimit: serverConfig.generation.dailySearchLimit,
  maxConcurrent: serverConfig.generation.maxConcurrent
});
const quizModel = serverConfig.generation.enabled && serverConfig.generation.openaiApiKey !== undefined
  ? createOpenAIQuizModelPort({ apiKey: serverConfig.generation.openaiApiKey })
  : undefined;
const quizPreparation = createQuizPreparation({
  governor: generationGovernor,
  id: randomUUID,
  model: quizModel,
  now: Date.now,
  policy: {
    circuitCooldownMs: serverConfig.generation.circuitCooldownMs,
    circuitFailureThreshold: serverConfig.generation.circuitFailureThreshold,
    deadlineMs: serverConfig.generation.timeoutMs,
    developingStoryCutoffMs: serverConfig.generation.developingStoryCutoffMs,
    evidenceCacheMaxEntries: serverConfig.generation.evidenceCacheMaxEntries,
    evidenceCacheTtlMs: serverConfig.generation.evidenceCacheTtlMs,
    retryLimit: serverConfig.generation.retryLimit
  }
});

const warRoomDependencies: WarRoomDependencies = {
  acceptingTraffic: () => traffic.accepting,
  admission: productionAdmission,
  createRoomIdAllocator: (presence) => new RoomIdAllocator(presence),
  log: (entry) => console.info(JSON.stringify(entry)),
  maxRegenerationsPerRound: serverConfig.generation.maxRegenerationsPerRound,
  newPreparationId: randomUUID,
  now: Date.now,
  quizPreparation,
  quizTelemetry: createQuizTelemetry(),
  reconnectGraceMs: (configuredGraceMs) => configuredGraceMs,
  trustProxy: serverConfig.trustProxy
};

export const productionWarRoomDependencies = Object.freeze(warRoomDependencies);

export function beginProductionShutdown(): void {
  traffic.accepting = false;
}
