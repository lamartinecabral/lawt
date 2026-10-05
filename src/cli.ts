#!/usr/bin/env node
import fsp from "node:fs/promises";
import { Command } from "commander";
import OpenAI from "openai";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { finish, printMessages } from "./io.ts";
import { run } from "./run.ts";
import { Session } from "./session.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { getProvider } from "./utils.ts";

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, "-v, --version")
  .option("-m, --model <model>", "model id")
  .option("-t, --think <think>", "reasoning effort")
  .option("-r, --resume", "resume session")
  .option("-l, --list", "list available models")
  .action(async (options) => {
    const client = new OpenAI(
      await loadProvider({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      }),
    );

    if (options.list) {
      await showAvailableModels({ client });
      finish();
      process.exit(0);
    }

    const settings = await loadSettings();

    const modelId = await assertModel(client, options.model ?? settings.model);

    const systemPrompt = await loadSystemPrompt(
      "You are an assistant with access to tools.",
    );

    const session = new Session(
      [{ role: "system", content: systemPrompt }],
      options.resume,
    );

    const reasoningEffort =
      options.think === undefined
        ? settings.reasoningEffort
        : parseReasoningEffort(options.think);

    await saveSettings({ model: modelId, reasoningEffort });

    console.log(pc.bgGreen(`LAWT - Local AI With Tools`));
    console.log(pc.dim(`   model: ${modelId}`));
    console.log(pc.dim(`thinking: ${String(reasoningEffort)}`));

    if (session.resumed) printMessages(session.messages);

    while (true) {
      const res = await run({
        client,
        modelId,
        session,
        reasoningEffort,
      });

      if (res?.trim() === "/exit") break;
      if (res?.trim() === "/quit") break;
      if (res?.trim() === "/export") {
        const filename = `messages-${Date.now()}.json`;
        await fsp.writeFile(
          filename,
          JSON.stringify(session.messages, null, 2),
          "utf-8",
        );
        console.log(pc.green(`Messages exported to ${filename}`));
      }
      if (res?.trim() === "/model") {
        await showAvailableModels({ client });
        finish();
        process.exit(0);
      }
    }

    console.log(pc.dim("\nGoodbye!"));
    finish();
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
