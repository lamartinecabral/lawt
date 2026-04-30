import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,mts,js,mjs}"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
    },
  },
});
