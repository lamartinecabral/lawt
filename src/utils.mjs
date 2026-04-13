// @ts-check
import { InvalidArgumentError } from "commander";
import { Ollama } from "ollama";
import pc from "picocolors";
import readline from "node:readline/promises";
import { z } from "zod";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/** @type {Set<{abort: () => any}>} */
export const abortables = new Set();

rl.on("close", () => {
  for (const abortable of abortables) abortable.abort();
  console.log(pc.dim("\nGood bye!"));
  process.exit(0);
});

export const question = () => {
  return rl.question("");
};

export const finish = () => {
  rl.close();
};

export const ellipsis = (str = "", len = 50) => {
  if (str.length > len) return str.substring(0, len - 1) + "…";
  return str;
};

export const optsSchema = z.object({
  model: z.string().nonempty(),
  prompt: z.string().nonempty().optional(),
  think: z
    .union([
      z.boolean(),
      z.literal("low"),
      z.literal("medium"),
      z.literal("high"),
    ])
    .optional(),
  system: z.string().nonempty(),
  context: z.coerce.number().int(),
});

export function parseThinkOption(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }
  throw new InvalidArgumentError(
    `Invalid value for --think: ${value}. Expected true, false, high, medium, or low.`,
  );
}

export const ollama = new Ollama();
