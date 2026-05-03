import type { ChatMessages, Effort } from "@openrouter/sdk/models";

import { Command, InvalidArgumentError } from "commander";
import { finish, projectRoot } from "../../utils.ts";
import { configDotenv } from "dotenv";
import { promises as fs } from "node:fs";
import { OpenRouter } from "@openrouter/sdk";
import pc from "picocolors";
import pkg from "../../../package.json" with { type: "json" };
import { run } from "./run.ts";
import z from "zod";

const program = new Command();

const client = new OpenRouter({
  apiKey: getApiKey(),
});

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, "-v, --version")
  .option(
    "-m, --model <model>",
    "OpenRouter model to use",
    "openai/gpt-oss-20b:free",
  )
  .option("-p, --prompt <prompt>", "Initial prompt")
  .option(
    "-t, --think <value>",
    "Enable model thinking (none|minimal|low|medium|high|xhigh)",
    parseThinkOption,
  )
  .option(
    "-s, --system <value>",
    "System prompt",
    "You are an assistant with access to tools.",
  )
  .action(async function () {
    const opts = optsSchema.parse(this.opts());

    await assertModel(opts.model);
    console.log(pc.bgGreen(`${this.name()} - ${this.description()}`));
    showOpts(opts);

    const messages: ChatMessages[] = [{ role: "system", content: opts.system }];

    if (opts.prompt) {
      await run({
        client,
        modelId: opts.model,
        messages,
        reasoningEffort: opts.think && { effort: opts.think },
        userPrompt: opts.prompt,
      });
    }

    while (true) {
      const res = await run({
        client,
        modelId: opts.model,
        messages,
        reasoningEffort: opts.think && { effort: opts.think },
        interceptUserPrompt: (prompt) => {
          if (prompt === "/exit") return true;
          if (prompt === "/clear") return true;
          if (prompt === "/save") return true;
          if (prompt === "/load") return true;
          if (prompt === "/show_opts") return true;
          if (prompt.startsWith("/system ")) return true;
          if (prompt.startsWith("/model ")) return true;
          if (prompt.startsWith("/think ")) return true;
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
          await fs.mkdir(`${process.cwd()}/.cache`, { recursive: true });
          await fs.writeFile(file, JSON.stringify({ opts, messages }, null, 2));
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
    }

    finish();
  });

function showOpts(opts: z.infer<typeof optsSchema>) {
  const { model, system, think } = opts;
  console.log(``);
  let maxLen = 0;
  [
    ["model", model],
    ["system prompt", system],
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

const optsSchema = z.object({
  model: z.string().nonempty(),
  prompt: z.string().nonempty().optional(),
  think: z
    .union([
      z.literal("none"),
      z.literal("minimal"),
      z.literal("low"),
      z.literal("medium"),
      z.literal("high"),
      z.literal("xhigh"),
    ])
    .optional(),
  system: z.string().nonempty(),
});

function getApiKey() {
  configDotenv({
    quiet: true,
    path: projectRoot + "/.env",
  });

  if (!process.env.OPENROUTER_API_KEY)
    throw new Error("OPENROUTER_API_KEY is required");

  return process.env.OPENROUTER_API_KEY;
}

export function parseThinkOption(value: string) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = value.toLowerCase();
  if (normalized === "default") return undefined;
  if (
    normalized === "xhigh" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low" ||
    normalized === "minimal" ||
    normalized === "none"
  ) {
    return normalized satisfies Effort;
  }
  throw new InvalidArgumentError(
    `Invalid value for --think: ${value}. Expected default, none, minimal, low, medium, high or xhigh.`,
  );
}

async function assertModel(model) {
  const response = await client.models.list();
  let modelNotFound;
  try {
    modelNotFound = !response.data.find((m) => m.id === model);
  } catch (err) {
    throw new Error("Failed to connect to OpenRouter.", { cause: err });
  }
  if (modelNotFound) throw new Error(`model ${model} not found`);
}

// START

program.parse();
