#!/usr/bin/env node

// @ts-check
import { exec } from "node:child_process";
import readline from "node:readline/promises";
import { Command, InvalidArgumentError } from "commander";
import { Ollama } from "ollama";
import ora from "ora";
import pc from "picocolors";
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
    const opts = this.opts();
    await presentation(opts);

    /** @type {import("ollama").Message[]} */
    const messages = [{ role: "system", content: opts.system }];

    while (true) {
      console.log(pc.green("--- user ---"));
      if (!opts.prompt) {
        opts.prompt = await rl.question("");
      } else {
        console.log(opts.prompt);
      }
      // prompt = "increment the value in counter.txt";

      if (opts.prompt === "exit") break;

      messages.push({ role: "user", content: opts.prompt });
      opts.prompt = "";

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
        for await (const { message, done } of response) {
          if (spinner.isSpinning) spinner.stop();
          if (message?.content) content += message.content;
          if (message?.tool_calls?.length)
            tool_calls.push(...message.tool_calls);
          if (!done) {
            const chunk = Object.fromEntries(
              [
                ["content", message.content],
                ["thinking", message.thinking],
                [
                  "tool_calls",
                  message.tool_calls && JSON.stringify(message.tool_calls),
                ],
              ].filter((a) => a[1]),
            );
            if ("thinking" in chunk) {
              if (mode !== "thinking") {
                if (mode) console.log("");
                console.log(pc.magenta("--- thinking ---"));
                mode = "thinking";
              }
              process.stdout.write(pc.dim(chunk.thinking));
            }
            if ("content" in chunk) {
              if (mode !== "content") {
                if (mode) console.log("");
                console.log(pc.blue("--- bot ---"));
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

          console.log(pc.yellow("--- tool ---"));
          console.log(
            pc.dim(ellipsis(`> ${tool_name}(${JSON.stringify(args)})`, 200)),
          );
          console.log(pc.dim(ellipsis(`= ${content}`, 200)));
        }
      }
    }
    console.log(pc.dim("Good bye!"));
    rl.close();
  });

// TOOLS

/** @type {Record<string, {definition: import("ollama").Tool, execute: (...args: any[]) => Promise<string>}>} */
const toolRegistry = {
  run_bash_command: {
    definition: {
      type: "function",
      function: {
        name: "run_bash_command",
        description:
          "Executes a bash shell command on the host system. Use this to read files, navigate the directory, install packages, or run scripts. Returns the terminal output.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description:
                "The exact bash command to run (e.g., 'ls -la', 'cat file.txt', 'mkdir new_folder').",
            },
          },
          required: ["command"],
        },
      },
    },
    execute: async ({ command }) => {
      try {
        // Execute the command with a timeout to prevent infinite hangs
        const { stdout, stderr } = await new Promise((res, rej) =>
          exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
            if (error) rej(error);
            res({ stderr, stdout });
          }),
        );

        // If the command succeeds but writes to stderr (common for warnings)
        if (stderr && !stdout) {
          return `Command executed with warnings/stderr:\n${stderr.trim()}`;
        }

        // Return standard output
        return stdout.trim() || "Command executed successfully with no output.";
      } catch (error) {
        // Return the error message to the AI so it knows what went wrong and can adapt
        // @ts-ignore
        return `Execution Failed.\nExit Code: ${error.code}\nError: ${error.message}`;
      }
    },
  },
};

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

async function presentation(opts) {
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
  let maxLen = 0;
  [
    ["model", model],
    ["system prompt", system],
    ["context length", context],
    ["thinking", think],
  ]
    .map((a) => {
      maxLen = Math.max(maxLen, a[0].length);
      return a;
    })
    .forEach(([a, b]) =>
      console.log(`${a}: `.padEnd(maxLen + 2, " "), pc.dim(b)),
    );
}

// START

program.parse();
