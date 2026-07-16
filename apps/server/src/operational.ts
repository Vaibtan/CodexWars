import { createServer, type Server, type ServerResponse } from "node:http";
import { PROTOCOL_VERSION } from "@codexwars/shared";

const SERVICE_NAME = "codexwars-server";

export interface OperationalDependencies {
  readonly isReady: () => boolean;
}

export interface OperationalResponse {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly service: typeof SERVICE_NAME;
  readonly status: "ok" | "ready" | "starting";
}

export interface OperationalApplication {
  get(path: string, handler: (_request: unknown, response: OperationalJsonResponse) => void): void;
  use(handler: (_request: unknown, response: OperationalJsonResponse) => void): void;
}

export interface OperationalJsonResponse {
  json(value: unknown): void;
  status(statusCode: number): OperationalJsonResponse;
}

interface ResolvedResponse {
  readonly body: OperationalResponse | { readonly code: "NOT_FOUND"; readonly message: "Route not found" };
  readonly statusCode: number;
}

export function operationalResponse(method: string | undefined, url: string | undefined, isReady: () => boolean): ResolvedResponse {
  if (method === "GET" && url === "/health") {
    return { body: { protocolVersion: PROTOCOL_VERSION, service: SERVICE_NAME, status: "ok" }, statusCode: 200 };
  }
  if (method === "GET" && url === "/ready") {
    const ready = isReady();
    return { body: { protocolVersion: PROTOCOL_VERSION, service: SERVICE_NAME, status: ready ? "ready" : "starting" }, statusCode: ready ? 200 : 503 };
  }
  return { body: { code: "NOT_FOUND", message: "Route not found" }, statusCode: 404 };
}

export function registerOperationalRoutes(app: OperationalApplication, isReady: () => boolean): void {
  app.get("/health", (_request, response) => {
    const resolved = operationalResponse("GET", "/health", isReady);
    response.status(resolved.statusCode).json(resolved.body);
  });
  app.get("/ready", (_request, response) => {
    const resolved = operationalResponse("GET", "/ready", isReady);
    response.status(resolved.statusCode).json(resolved.body);
  });
  app.use((_request, response) => {
    const resolved = operationalResponse(undefined, undefined, isReady);
    response.status(resolved.statusCode).json(resolved.body);
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: OperationalResponse | { readonly code: "NOT_FOUND"; readonly message: "Route not found" }): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export function createOperationalServer(dependencies: OperationalDependencies): Server {
  return createServer((request, response) => {
    const resolved = operationalResponse(request.method, request.url, dependencies.isReady);
    writeJson(response, resolved.statusCode, resolved.body);
  });
}
