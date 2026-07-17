import { describe, expect, it } from "vitest";
import { operationalResponse } from "../src/operational.js";

describe("operational HTTP policy", () => {
  it("reports liveness without depending on room readiness", () => {
    expect(operationalResponse("GET", "/health", () => false, "fallback_only")).toEqual({
      body: {
        protocolVersion: 2,
        quizGeneration: "fallback_only",
        service: "codexwars-server",
        status: "ok"
      },
      statusCode: 200
    });
  });

  it("reports readiness only after room registration", () => {
    expect(operationalResponse("GET", "/ready", () => false, "fallback_only")).toMatchObject({
      body: { status: "starting" },
      statusCode: 503
    });
    expect(operationalResponse("GET", "/ready", () => true, "fallback_only")).toMatchObject({
      body: { status: "ready" },
      statusCode: 200
    });
  });

  it("returns a bounded JSON error for unknown routes", () => {
    expect(operationalResponse("GET", "/not-a-route", () => true, "fallback_only")).toEqual({
      body: { code: "NOT_FOUND", message: "Route not found" },
      statusCode: 404
    });
  });
});
