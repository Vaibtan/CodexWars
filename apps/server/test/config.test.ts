import { describe, expect, it } from "vitest";
import { loadServerConfig } from "../src/config.js";

describe("server configuration", () => {
  it("keeps the server fallback-capable when generation credentials are absent", () => {
    expect(loadServerConfig({})).toMatchObject({
      generation: {
        capability: "fallback_only",
        enabled: false,
        evidenceCacheMaxEntries: 64,
        evidenceCacheTtlMs: 900_000,
        model: "gpt-5.4-mini-2026-03-17"
      },
      port: 4000
    });
  });

  it("rejects unsafe numeric values and unreviewed model changes", () => {
    expect(() => loadServerConfig({ QUIZ_PREPARATION_TIMEOUT_MS: "0" })).toThrow("QUIZ_PREPARATION_TIMEOUT_MS");
    expect(() => loadServerConfig({ QUIZ_EVIDENCE_CACHE_MAX_ENTRIES: "0" })).toThrow("QUIZ_EVIDENCE_CACHE_MAX_ENTRIES");
    expect(() => loadServerConfig({ QUIZ_EVIDENCE_CACHE_MAX_ENTRIES: "1025" })).toThrow("QUIZ_EVIDENCE_CACHE_MAX_ENTRIES");
    expect(() => loadServerConfig({ QUIZ_EVIDENCE_CACHE_TTL_MS: "0" })).toThrow("QUIZ_EVIDENCE_CACHE_TTL_MS");
    expect(() => loadServerConfig({ QUIZ_EVIDENCE_CACHE_TTL_MS: "86400001" })).toThrow("QUIZ_EVIDENCE_CACHE_TTL_MS");
    expect(() => loadServerConfig({ QUIZ_GENERATION_RETRY_LIMIT: "2" })).toThrow("QUIZ_GENERATION_RETRY_LIMIT");
    expect(() => loadServerConfig({ OPENAI_MODEL: "gpt-latest" })).toThrow("OPENAI_MODEL");
  });
});
