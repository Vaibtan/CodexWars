import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createOperationalServer } from "../src/operational.js";

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (server === undefined) {
      resolve();
      return;
    }

    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  server = undefined;
});

async function start(isReady: () => boolean): Promise<string> {
  server = createOperationalServer({ generationCapability: "fallback_only", isReady });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP listener");
  }

  return `http://127.0.0.1:${address.port}`;
}

describe("operational HTTP interface", () => {
  it("reports liveness without depending on room readiness", async () => {
    const baseUrl = await start(() => false);

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      protocolVersion: 2,
      quizGeneration: "fallback_only",
      service: "codexwars-server",
      status: "ok"
    });
  });

  it("reports readiness only after room registration", async () => {
    let ready = false;
    const baseUrl = await start(() => ready);

    const beforeRegistration = await fetch(`${baseUrl}/ready`);
    expect(beforeRegistration.status).toBe(503);
    await expect(beforeRegistration.json()).resolves.toEqual({
      protocolVersion: 2,
      quizGeneration: "fallback_only",
      service: "codexwars-server",
      status: "starting"
    });

    ready = true;
    const afterRegistration = await fetch(`${baseUrl}/ready`);
    expect(afterRegistration.status).toBe(200);
    await expect(afterRegistration.json()).resolves.toEqual({
      protocolVersion: 2,
      quizGeneration: "fallback_only",
      service: "codexwars-server",
      status: "ready"
    });
  });

  it("returns a bounded JSON error for unknown routes", async () => {
    const baseUrl = await start(() => true);

    const response = await fetch(`${baseUrl}/not-a-route`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Route not found"
    });
  });
});
