import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["live-tests/**/*.live.ts"],
    testTimeout: 180_000
  }
});
