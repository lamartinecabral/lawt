import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin/cli.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist/bin",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  platform: "node",
  external: [
    "commander",
    "ollama",
    "zod",
    "fs-extra",
    "fast-glob",
    "picocolors",
    "ora",
    "pino",
    "pino-pretty",
    "fsevents",
  ],
  shims: false,
});
