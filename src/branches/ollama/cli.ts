import { Command, InvalidArgumentError } from "commander";
import { finish } from "../../utils.ts";
import { promises as fs } from "node:fs";
import type { Message } from "ollama";
import { Ollama } from "ollama";
import pc from "picocolors";
import pkg from "../../../package.json" with { type: "json" };
import { run } from "./run.ts";
import z from "zod";

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
  .action(async function () {
    const opts = optsSchema.parse(this.opts());

    const model = await assertModel(opts.model);
    console.log(pc.bgGreen(`${this.name()} - ${this.description()}`));
    showOpts({ ...opts, model });

    const messages: Message[] = [{ role: "system", content: opts.system }];

    if (opts.prompt) {
      await run({
        ollama,
        modelId: model,
        messages,
        reasoningEffort: opts.think,
        userPrompt: opts.prompt,
      });
    }

    while (true) {
      const res = await run({
        ollama,
        modelId: model,
        messages,
        reasoningEffort: opts.think,
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
        const file = `${process.cwd()}/.cache/${pkg.name}_state.json`;
        try {
          await fs.mkdir(`${process.cwd()}/.cache`, { recursive: true });
          await fs.writeFile(file, JSON.stringify({ opts, messages }, null, 2));
          console.log(pc.green("\n✓"), pc.dim(`State saved to ${file}`));
        } catch (e) {
          console.log(pc.red("\n✕"), pc.dim(`Error saving state: ${e}`));
        }
      }
      if (res === "/load") {
        const file = `${process.cwd()}/.cache/${pkg.name}_state.json`;
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
          opts.model = await assertModel(model);
          console.log(
            pc.green("\n✓"),
            pc.dim(`Model changed to '${opts.model}'`),
          );
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

const ollama = new Ollama();

async function assertModel(model: string): Promise<string> {
  const response = await ollama.list();
  let modelNotFound;
  try {
    const exactMatch = response.models.find((m) => m.model === model);
    if (exactMatch) return model;
    const candidates = response.models.filter((m) => m.model.startsWith(model));
    if (candidates.length) return candidates[0].model;
    modelNotFound = true;
  } catch (err) {
    throw new Error(
      "Failed to connect to Ollama. Please make sure Ollama is installed and running.",
      { cause: err },
    );
  }
  if (modelNotFound) throw new Error(`model ${model} not found`);
  return model;
}

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
});

export function parseThinkOption(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = value.toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "default") return undefined;
  if (
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }
  throw new InvalidArgumentError(
    `Invalid value for --think: ${value}. Expected default, true, false, high, medium, or low.`,
  );
}

// START

program.parse();
