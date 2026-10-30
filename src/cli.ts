#!/usr/bin/env node
import fsp from "node:fs/promises";
import { Command } from "commander";
import OpenAI from "openai";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { finish, printMessages, printUsage } from "./io.ts";
import { run } from "./run.ts";
import { Session } from "./session.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { getProvider } from "./utils.ts";

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, "-v, --version")
  .option("-m, --model <model>", "model ID")
  .option("-e, --exec <task_prompt>", "execute one task and exit")
  .option("-t, --think <think>", "reasoning effort")
  .option("-r, --resume", "resume session")
  .option("-c, --custom", "allow a custom model ID")
  .option("--temperature <temperature>", "set the temperature for the model")
  .option("--top-p <top_p>", "set the top_p for the model")
  .action(async (options) => {
    const client = new OpenAI(
      await loadProvider({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      }),
    );

    const { model, reasoningEffort, ...otherSettings } = await loadSettings();

    const modelId = options.custom
      ? String(options.model ?? model)
      : await assertModel(client, options.model ?? model);

    const systemPrompt = await loadSystemPrompt(
      "You are an assistant with access to tools.",
    );

    const session = new Session(
      [{ role: "system", content: systemPrompt }],
      options.resume,
    );

    if (!options.resume && options.exec) {
      session.push({
        role: "user",
        content: options.exec,
      });
    }

    if (options.temperature)
      otherSettings.temperature = parseFloat(options.temperature);
    if (options.topP) otherSettings.top_p = parseFloat(options.topP);

    const thinking =
      options.think === undefined
        ? reasoningEffort
        : parseReasoningEffort(options.think);

    await saveSettings({ model: modelId, reasoningEffort: thinking });

    console.log(pc.bgGreen(`LAWT - Local AI With Tools`));
    console.log(pc.dim(`   model: ${modelId}`));
    console.log(pc.dim(`thinking: ${String(thinking)}`));

    if (session.resumed) printMessages(session.messages);

    let stream = true;
    let usage: Awaited<ReturnType<typeof run>>["usage"];

    while (true) {
      const { finishReason, usage: usageData } = await run({
        client,
        modelId,
        session,
        reasoningEffort: thinking,
        stream,
        otherSettings,
      });
      if (usageData) usage = usageData;

      if (!options.resume && options.exec && finishReason !== "cancelled") {
        finish();
        process.exit(0);
      }

      if (finishReason === "exit_command") break;
      if (finishReason === "export_command") {
        const filename = `messages-${Date.now()}.json`;
        await fsp.writeFile(
          filename,
          JSON.stringify(session.messages, null, 2),
          "utf-8",
        );
        console.log(pc.green(`Messages exported to ${filename}`));
      }
      if (finishReason === "list_command") {
        await showAvailableModels({ client });
        finish();
        process.exit(0);
      }
      if (finishReason === "toggle_stream") {
        stream = !stream;
        console.log(
          pc.green(`Streaming is now ${stream ? "enabled" : "disabled"}.`),
        );
      }
    }

    console.log(pc.dim("\nGoodbye!"));
    if (usage) printUsage(usage);
    finish();
  });

program
  .command("list")
  .description("list available models")
  .action(async () => {
    const client = new OpenAI(
      await loadProvider({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      }),
    );

    await showAvailableModels({ client });
    finish();
    process.exit(0);
  });

const parseReasoningEffort = (value: string) => {
  if (value === "null") return null;
  if (!value) return undefined;
  return String(value);
};

const loadSystemPrompt = async (defaultMessage: string) => {
  let systemMessage = defaultMessage;
  const systemPromptPaths = [
    "./AGENTS.md",
    `${process.env.HOME}/.lawt/AGENTS.md`,
  ];
  for (const p of systemPromptPaths) {
    try {
      const content = await fsp.readFile(p, "utf-8");
      if (content.trim()) {
        systemMessage = content.trim();
        break;
      }
    } catch (_) {
      // ignore
    }
  }
  return systemMessage;
};

const loadProvider = async (defaultProvider: {
  baseURL: string;
  apiKey: string;
}): Promise<typeof defaultProvider> => {
  const provider = await getProvider();
  if (provider.baseURL && provider.apiKey)
    return {
      baseURL: provider.baseURL,
      apiKey: provider.apiKey,
    };
  return defaultProvider;
};

const assertModel = async (client: OpenAI, modelId: string | undefined) => {
  const models = await client.models.list();

  if (modelId && models.data.find((m) => m.id === modelId)) return modelId;

  showAvailableModels({ models });

  finish();
  process.exit(1);
};

const showAvailableModels = async (
  params: { client: OpenAI } | { models: OpenAI.Models.ModelsPage },
) => {
  const models =
    "models" in params ? params.models : await params.client.models.list();

  const modelIds = models.data
    .map((m) => m.id)
    .sort((a, b) => a.localeCompare(b));

  console.log(pc.green("\nAvailable Models:\n"));
  for (const id of modelIds) {
    console.log(`- ${pc.cyan(id)}`);
  }
  console.log();
};

program.parse();
