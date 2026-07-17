import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      OPENAI_API_KEY: "",
      QUIZ_GENERATION_ENABLED: "false"
    },
    fileParallelism: false
  }
});
