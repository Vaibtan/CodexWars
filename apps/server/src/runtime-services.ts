import { createAdmissionControl } from "./admission-control.js";
import { serverConfig } from "./config.js";
import { createQuizTelemetry, createRuntimeQuizPreparation } from "./quiz/index.js";

export const productionAdmission = createAdmissionControl(serverConfig.admission);
export const productionQuizPreparation = createRuntimeQuizPreparation(serverConfig);
export const productionQuizTelemetry = createQuizTelemetry();
