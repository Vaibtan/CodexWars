import { PROTOCOL_VERSION } from "@codexwars/shared";
import type { GenerationCapability } from "./config.js";

const SERVICE_NAME = "codexwars-server";

export interface OperationalResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly quizGeneration: GenerationCapability;
  readonly service: typeof SERVICE_NAME;
  readonly status: "ok" | "ready" | "starting";
}

export interface OperationalApplication {
  get(path: string, handler: (_request: unknown, response: OperationalJsonResponse) => void): void;
  use(handler: (request: never, response: OperationalJsonResponse, next: () => void) => void): void;
}

export interface OperationalJsonResponse {
  json(value: unknown): void;
  status(statusCode: number): OperationalJsonResponse;
}

interface ResolvedResponse {
  readonly body: OperationalResponse | { readonly code: "NOT_FOUND"; readonly message: "Route not found" };
  readonly statusCode: number;
}

export function operationalResponse(method: string | undefined, url: string | undefined, isReady: () => boolean, generationCapability: GenerationCapability): ResolvedResponse {
  if (method === "GET" && url === "/health") {
    return { body: { protocolVersion: PROTOCOL_VERSION, quizGeneration: generationCapability, service: SERVICE_NAME, status: "ok" }, statusCode: 200 };
  }
  if (method === "GET" && url === "/ready") {
    const ready = isReady();
    return { body: { protocolVersion: PROTOCOL_VERSION, quizGeneration: generationCapability, service: SERVICE_NAME, status: ready ? "ready" : "starting" }, statusCode: ready ? 200 : 503 };
  }
  return { body: { code: "NOT_FOUND", message: "Route not found" }, statusCode: 404 };
}

export function registerOperationalRoutes(app: OperationalApplication, isReady: () => boolean, generationCapability: GenerationCapability): void {
  app.get("/health", (_request, response) => {
    const resolved = operationalResponse("GET", "/health", isReady, generationCapability);
    response.status(resolved.statusCode).json(resolved.body);
  });
  app.get("/ready", (_request, response) => {
    const resolved = operationalResponse("GET", "/ready", isReady, generationCapability);
    response.status(resolved.statusCode).json(resolved.body);
  });
  app.use((_request, response) => {
    const resolved = operationalResponse(undefined, undefined, isReady, generationCapability);
    response.status(resolved.statusCode).json(resolved.body);
  });
}
