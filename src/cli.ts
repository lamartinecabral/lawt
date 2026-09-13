#!/usr/bin/env node
import fs from "node:fs";
import { Command } from "commander";
import OpenAI from "openai";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { finish } from "./io.ts";
import { run } from "./run.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { getProvider } from "./utils.ts";

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, "-v, --version")
  .option("-m, --model <model>", "model id")
  .option("-t, --think <think>", "reasoning effort")
  .action(async (options) => {
    const settings = await loadSettings();
    const client = new OpenAI(
      await loadProvider({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      }),
    );

    const modelId = await assertModel(client, options.model ?? settings.model);

    const systemPrompt = await loadSystemPrompt(
      "You are an assistant with access to tools.",
    );

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    const reasoningEffort =
      options.think === undefined
        ? settings.reasoningEffort
        : parseReasoningEffort(options.think);

    await saveSettings({ model: modelId, reasoningEffort });

    console.log(pc.bgGreen(`LAWT - Local AI With Tools`));
    console.log(pc.dim(`   model: ${modelId}`));
    console.log(pc.dim(`thinking: ${String(reasoningEffort)}`));

    while (true) {
      const res = await run({
        client,
        modelId,
        messages,
        reasoningEffort,
      });

      if (res?.trim() === "/exit") break;
      if (res?.trim() === "/quit") break;
      if (res?.trim() === "/export") {
        const filename = `messages-${Date.now()}.json`;
        await fs.promises.writeFile(
          filename,
          JSON.stringify(messages, null, 2),
          "utf-8",
        );
        console.log(pc.green(`Messages exported to ${filename}`));
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
      const content = await fs.promises.readFile(p, "utf-8");
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

  console.log(pc.green("\nAvailable Models:\n"));
  for (const model of models.data) {
    console.log(`- ${pc.cyan(model.id)}`);
  }
  console.log();

  finish();
  process.exit(0);
};

program.parse();
