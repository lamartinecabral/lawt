#!/usr/bin/env node

// @ts-check
import { assertModel, finish, optsSchema, parseThinkOption } from "./utils.mjs";
import { Command } from "commander";
import { promises as fs } from "node:fs";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { run } from "./run.mjs";

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, "-v, --version")
  .option("-m, --model <model>", "Ollama model to use", "gpt-oss:20b")
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
  .option("-c, --context <number>", "Context length", "32000")
  .action(async function () {
    const opts = optsSchema.parse(this.opts());

    await assertModel(opts.model);
    console.log(pc.bgGreen(`${this.name()} - ${this.description()}`));
    showOpts(opts);

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
        interceptUserPrompt: (prompt) => {
          if (prompt === "/exit") return true;
          if (prompt === "/clear") return true;
          if (prompt === "/save") return true;
          if (prompt === "/load") return true;
          if (prompt === "/show_opts") return true;
          if (prompt.startsWith("/system ")) return true;
          if (prompt.startsWith("/model ")) return true;
          if (prompt.startsWith("/think ")) return true;
          if (prompt.startsWith("/context ")) return true;
          return false;
        },
      });

      if (res === "/exit") break;
      if (res === "/clear") {
        messages.splice(1);
        console.log(pc.green("\n✓"), pc.dim("Context cleared"));
      }
      if (res === "/save") {
        const file = `${process.cwd()}/.cache/minicode_state.json`;
        try {
          await fs.writeFile(file, JSON.stringify({ opts, messages }));
          console.log(pc.green("\n✓"), pc.dim(`State saved to ${file}`));
        } catch (e) {
          console.log(pc.red("\n✕"), pc.dim(`Error saving state: ${e}`));
        }
      }
      if (res === "/load") {
        const file = `${process.cwd()}/.cache/minicode_state.json`;
        try {
          const data = JSON.parse(await fs.readFile(file, "utf-8"));
          if (data.opts) Object.assign(opts, data.opts);
          if (data.messages)
            messages.splice(0, messages.length, ...data.messages);
          console.log(pc.green("\n✓"), pc.dim(`State loaded from ${file}`));
        } catch (e) {
          console.log(pc.red("\n✕"), pc.dim(`Error loading state: ${e}`));
        }
      }
      if (res === "/show_opts") {
        showOpts(opts);
      }
      if (res?.startsWith("/system ")) {
        opts.system = messages[0].content = res.substring(8).trim();
        console.log(pc.green("\n✓"), pc.dim("System prompt changed"));
      }
      if (res?.startsWith("/model ")) {
        try {
          const model = res.substring(7).trim();
          await assertModel(model);
          opts.model = model;
          console.log(pc.green("\n✓"), pc.dim(`Model changed to '${model}'`));
        } catch (e) {
          console.log(
            pc.red("\n✕"),
            pc.dim(`${e instanceof Error ? e.message : e}`),
          );
        }
      }
      if (res?.startsWith("/think ")) {
        try {
          opts.think = parseThinkOption(res.substring(7).trim());
          console.log(
            pc.green("\n✓"),
            pc.dim(`Thinking changed to '${opts.think}'`),
          );
        } catch (e) {
          console.log(
            pc.red("\n✕"),
            pc.dim(`${e instanceof Error ? e.message : e}`),
          );
        }
      }
      if (res?.startsWith("/context ")) {
        const context = +res.substring(9);
        if (Number.isInteger(context) && context > 0) {
          opts.context = context;
          console.log(
            pc.green("\n✓"),
            pc.dim(`Context length changed to '${opts.context}'`),
          );
        } else {
          console.log(pc.red("\n✕"), pc.dim(`Invalid value`));
        }
      }
    }

    finish();
  });

/** @param {import('zod').z.infer<typeof optsSchema>} opts */
function showOpts(opts) {
  const { model, system, context, think } = opts;
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
