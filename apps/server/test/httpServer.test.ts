import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createCodexWarsHttpServer } from "../src/httpServer.js";

const openServers = new Set<ReturnType<typeof createCodexWarsHttpServer>>();

afterEach(async () => {
  await Promise.all(
    [...openServers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  openServers.clear();
});

async function startServer() {
  const server = createCodexWarsHttpServer();
  openServers.add(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("CodexWars HTTP server", () => {
  it("reports service health", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      service: "codexwars-server",
      status: "ok",
    });
  });

  it.each([
    ["GET", "/missing"],
    ["POST", "/health"],
  ])("returns JSON 404 for %s %s", async (method, path) => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}${path}`, { method });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
