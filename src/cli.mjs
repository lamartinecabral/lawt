#!/usr/bin/env node

// @ts-check
import { Ollama } from "ollama";
import ora from "ora";
import pc from "picocolors";
import readline from "node:readline/promises";
import { toolRegistry } from "./tools.mjs";

import { Command, InvalidArgumentError } from "commander";

import pkg from "../package.json" with { type: "json" };

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let activeResponse;
rl.on("close", () => {
  if (activeResponse) activeResponse.abort();
  process.exit(0);
});

const ollama = new Ollama();

const program = new Command();

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
    await presentation(this);
    const opts = this.opts();
    let prompt = opts.prompt;

    /** @type {import("ollama").Message[]} */
    const messages = [{ role: "system", content: opts.system }];

    while (true) {
      console.log(pc.green("\n--- user ---"));
      if (!prompt) {
        prompt = await rl.question("");
      } else {
        console.log(prompt);
      }
      // prompt = "increment the value in counter.txt";

      if (prompt === "exit") break;

      messages.push({ role: "user", content: prompt });
      prompt = "";

      while (true) {
        const spinner = ora().start();

        const response = await ollama.chat({
          stream: true,
          options: { num_ctx: +opts.context },
          model: opts.model,
          messages,
          tools: Object.values(toolRegistry).map((a) => a.definition),
          think: opts.think,
        });

        activeResponse = response;

        let content = "";
        let tool_calls = [];

        let mode = "";
        for await (const res of response) {
          const { message, done } = res;
          if (spinner.isSpinning) spinner.stop();
          if (message?.content) content += message.content;
          if (message?.tool_calls?.length)
            tool_calls.push(...message.tool_calls);
          if (!done) {
            const chunk = Object.fromEntries(
              [
                ["content", message.content],
                ["thinking", message.thinking],
              ].filter((a) => a[1]),
            );
            if ("thinking" in chunk) {
              if (mode !== "thinking") {
                if (mode) console.log("");
                console.log(pc.magenta("\n--- thinking ---"));
                mode = "thinking";
              }
              process.stdout.write(pc.dim(chunk.thinking));
            }
            if ("content" in chunk) {
              if (mode !== "content") {
                if (mode) console.log("");
                console.log(pc.blue("\n--- bot ---"));
                mode = "content";
              }
              process.stdout.write(chunk.content);
            }
          }
        }
        if (mode) console.log("");

        activeResponse = null;

        messages.push({
          role: "assistant",
          content,
          tool_calls: tool_calls.length ? tool_calls : undefined,
        });

        if (!tool_calls.length) break;

        for (const tool_call of tool_calls) {
          const tool_name = tool_call.function.name;
          const args = tool_call.function.arguments;
          const content = await toolRegistry[tool_name].execute(args);
          messages.push({ role: "tool", tool_name, content });

          console.log(pc.yellow("\n--- tool ---"));
          console.log(
            pc.dim(ellipsis(`> ${tool_name}(${JSON.stringify(args)})`, 300)),
          );
          console.log(pc.dim(ellipsis(`= ${content}`, 300)));
        }
      }
    }
    console.log(pc.dim("Good bye!"));
    rl.close();
  });

// UTILS

const ellipsis = (str = "", len = 50) => {
  if (str.length > len) return str.substring(0, len - 1) + "…";
  return str;
};

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
