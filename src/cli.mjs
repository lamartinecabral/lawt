#!/usr/bin/env node

// @ts-check
import { finish, ollama, optsSchema, parseThinkOption } from "./utils.mjs";
import { Command } from "commander";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { run } from "./run.mjs";

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
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

    await presentation(this, opts);

    /** @type {import("ollama").Message[]} */
    const messages = [{ role: "system", content: opts.system }];

    if (opts.prompt) {
      await run({
        modelId: opts.model,
        messages,
        reasoningEffort: opts.think,
        contextLength: opts.context,
        userPrompt: opts.prompt,
      });
    }

    while (true) {
      const res = await run({
        modelId: opts.model,
        messages,
        reasoningEffort: opts.think,
        contextLength: opts.context,
        interceptPrompt: (prompt) => {
          if (prompt === "/exit") return true;
          if (prompt === "/clear") return true;
          if (prompt === "/save") return true;
          if (prompt === "/load") return true;
          if (prompt.startsWith("/system ")) return true;
          if (prompt.startsWith("/think ")) return true;
          if (prompt.startsWith("/context ")) return true;
          return false;
        },
      });

      if (res === "/exit") break;
      if (res === "/clear") {
        messages.splice(1);
        console.log(pc.dim("\nContext cleared"));
      }
      if (res === "/save") {
        console.log(pc.dim("\nnot implemented yet"));
      }
      if (res === "/load") {
        console.log(pc.dim("\nnot implemented yet"));
      }
      if (res?.startsWith("/system ")) {
        messages[0].content = res.substring(8).trim();
        console.log(pc.dim("\nSystem prompt changed"));
      }
      if (res?.startsWith("/think ")) {
        try {
          opts.think = parseThinkOption(res.substring(7).trim());
          console.log(pc.dim(`\nThinking changed to '${opts.think}'`));
        } catch (e) {
          console.log(pc.dim(`\n${e instanceof Error ? e.message : e}`));
        }
      }
      if (res?.startsWith("/context ")) {
        opts.context = +res.substring(9);
        console.log(pc.dim(`\nContext length changed to '${opts.context}'`));
      }
    }

    finish();
  });

/**
 * @param {Command} cmd
 * @param {import('zod').z.infer<typeof optsSchema>} opts
 */
async function presentation(cmd, opts) {
  const { model, system, context, think } = opts;
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
      maxLen = Math.max(maxLen, String(a[0]).length);
      return a;
    })
    .forEach(([a, b]) =>
      console.log(`${a}:`.padEnd(maxLen + 1, " "), pc.dim(String(b))),
    );
}

// START

program.parse();
