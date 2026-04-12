import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
    },
  },
});
