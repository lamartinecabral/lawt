#!/usr/bin/env node

// @ts-check
import { finish, ollama } from "./utils.mjs";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { run } from "./run.mjs";
import { z } from "zod";

import { Command, InvalidArgumentError } from "commander";

const program = new Command();

const optsSchema = z.object({
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

/** @typedef {z.infer<typeof optsSchema>} Opts */

program
  .name("minicode")
  .description("CLI AI agent powered by Ollama")
  .version(pkg.version, "-v, --version")
  .option("-m, --model <model>", "Ollama model to use", "gemma4:e2b")
  .option("-p, --prompt <prompt>", "Initial prompt")
  .option(
    "-t, --think <value>",
    "Enable model thinking (true|false|high|medium|low)",
    parseThinkOption,
  )
  .option(
    "-s, --system <value>",
    "System prompt",
    "You are an assistant with access to tools.",
  )
  .option("-c, --context <number>", "Context length", "16000")
  .action(async function () {
    const opts = optsSchema.parse(this.opts());

    await presentation(this);

    /** @type {import("ollama").Message[]} */
    const messages = [{ role: "system", content: opts.system }];

    if (opts.prompt) {
      const res = await run({
        modelId: opts.model,
        messages,
        reasoningEffort: opts.think,
        contextLength: opts.context,
        userPrompt: opts.prompt,
      });

      if (res === "break") finish();
    }

    while (true) {
      const res = await run({
        modelId: opts.model,
        messages,
        reasoningEffort: opts.think,
        contextLength: opts.context,
      });

      if (res === "break") break;
    }

    finish();
  });

// UTILS

function parseThinkOption(value) {
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

/** @param {Command} cmd */
async function presentation(cmd) {
  const { model, system, context, think } = cmd.opts();
  const response = await ollama.list();
  let modelNotFound;
  try {
    modelNotFound = !response.models.find((m) => m.model === model);
  } catch (err) {
    throw new Error(
      "Failed to connect to Ollama. Please make sure Ollama is installed and running.",
      { cause: err },
    );
  }
  if (modelNotFound) throw new Error(`model ${model} not found`);
  console.log(pc.bgGreen(`${cmd.name()} - ${cmd.description()}`));
  console.log(``);
  let maxLen = 0;
  [
    ["model", model],
    ["system prompt", system],
    ["context length", context],
    ["thinking", think ?? "default"],
  ]
    .map((a) => {
      maxLen = Math.max(maxLen, a[0].length);
      return a;
    })
    .forEach(([a, b]) =>
      console.log(`${a}:`.padEnd(maxLen + 1, " "), pc.dim(b)),
    );
}

// START

program.parse();
