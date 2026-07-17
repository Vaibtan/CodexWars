import { describe, expect, it } from "vitest";
import { loadServerConfig } from "../src/config.js";

describe("server configuration", () => {
  it("keeps the server fallback-capable when generation credentials are absent", () => {
    expect(loadServerConfig({})).toMatchObject({
      generation: { capability: "fallback_only", enabled: false, model: "gpt-5.4-mini-2026-03-17" },
      port: 4000
    });
  });

  it("rejects unsafe numeric values and unreviewed model changes", () => {
    expect(() => loadServerConfig({ QUIZ_PREPARATION_TIMEOUT_MS: "0" })).toThrow("QUIZ_PREPARATION_TIMEOUT_MS");
    expect(() => loadServerConfig({ OPENAI_MODEL: "gpt-latest" })).toThrow("OPENAI_MODEL");
  });
});
