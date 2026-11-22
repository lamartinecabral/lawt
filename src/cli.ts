#!/usr/bin/env node
import fsp from "node:fs/promises";
import { Command } from "commander";
import OpenAI from "openai";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import type { Usage } from "./io.ts";
import { finish, printMessages, printUsage, prompt } from "./io.ts";
import { run } from "./run.ts";
import { Session } from "./session.ts";
import {
  loadSettings,
  saveSettings,
  setInferenceProvider,
} from "./settings.ts";
import type { Providers } from "./utils.ts";
import { getProviders, isRecord, saveProviders } from "./utils.ts";

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
  .option("--top-k <top_k>", "set the top_k for the model")
  .action(async (options) => {
    const { model, reasoningEffort, provider, ...otherSettings } =
      await loadSettings();

    const client = new OpenAI(await loadProvider(provider?.inference));

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
    if (options.topK) otherSettings.top_k = parseFloat(options.topK);

    const thinking =
      options.think === undefined
        ? reasoningEffort
        : parseReasoningEffort(options.think);

    await saveSettings({ model: modelId, reasoningEffort: thinking });

    console.log(pc.bgGreen(`LAWT - Local AI With Tools`));
    console.log(pc.dim(`   model: ${modelId}`));
    console.log(pc.dim(`thinking: ${String(thinking)}`));

    if (session.resumed) printMessages(session.messages);

    const usage: Usage = {
      total_completion_tokens: 0,
      last_request: undefined,
    };

    while (true) {
      const { finishReason, usage: usageData } = await run({
        client,
        modelId,
        session,
        reasoningEffort: thinking,
        otherSettings,
      });
      if (usageData) {
        usage.last_request = usageData.last_request;
        usage.total_completion_tokens += Number(
          usageData.total_completion_tokens ?? 0,
        );
      }

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
      if (finishReason === "export_toolcalls_command") {
        const filename = `toolcalls-${Date.now()}.txt`;
        await fsp.writeFile(
          filename,
          session.messages
            .filter((a): a is OpenAI.ChatCompletionAssistantMessageParam => {
              return a.role === "assistant";
            })
            .flatMap((a) => a.tool_calls)
            .filter((a): a is OpenAI.ChatCompletionMessageFunctionToolCall => {
              return !!a && a.type === "function";
            })
            .map((a) => a.function)
            .map((a) => `${a.name}(${a.arguments})`)
            .join("\n"),
          "utf-8",
        );
        console.log(pc.green(`Tool calls exported to ${filename}`));
      }
      if (finishReason === "usage_command") {
        const success = printUsage(usage);
        if (!success) {
          console.log(pc.dim("No usage data available for this session."));
        }
      }
    }

    console.log(pc.dim("\nGoodbye!"));
    printUsage(usage, true);
    finish();
  });

program
  .command("list")
  .alias("ls")
  .description("list available models")
  .action(async () => {
    const client = new OpenAI(
      await loadProvider((await loadSettings()).provider?.inference),
    );

    await showAvailableModels({ client });
    finish();
    process.exit(0);
  });

const providerCommand = program
  .command("provider")
  .description("manage inference providers");

providerCommand
  .command("list")
  .description("list configured inference providers")
  .action(
    withProviderAction(async () => {
      const providers = await getProviders();
      const inference = isRecord(providers.inference)
        ? providers.inference
        : {};
      const configuredSelection =
        (await loadSettings()).provider?.inference ?? "default";
      const selected =
        configuredSelection === "default" ||
        isValidInferenceProvider(inference[configuredSelection])
          ? configuredSelection
          : "default";

      console.log(pc.green("\nInference Providers:\n"));
      printInferenceProvider("default", "http://localhost:9931/v1", selected);

      const ids = Object.keys(inference).sort((a, b) => a.localeCompare(b));
      for (const id of ids) {
        const provider = inference[id];
        const baseURL =
          isRecord(provider) && typeof provider.baseURL === "string"
            ? provider.baseURL
            : "(invalid configuration)";
        printInferenceProvider(id, baseURL, selected);
      }
      if (ids.length === 0) {
        console.log(pc.dim("No additional providers configured."));
      }
      console.log();
    }),
  );

providerCommand
  .command("select <id>")
  .description("select an inference provider (use 'default' for Llama)")
  .action(
    withProviderAction(async (id: string) => {
      assertProviderId(id);
      if (id !== "default") {
        const provider = (await getProviders()).inference?.[id];
        if (!isValidInferenceProvider(provider)) {
          throw new Error(`Unknown or invalid inference provider: ${id}`);
        }
      }

      await setInferenceProvider(id);
      console.log(pc.green(`Selected inference provider: ${id}`));
    }),
  );

providerCommand
  .command("add [id]")
  .description("add an OpenAI-compatible inference provider")
  .option("--base-url <url>", "provider API base URL")
  .option("--api-key <key>", "provider API key")
  .action(
    withProviderAction(
      async (
        id: string | undefined,
        options: { baseUrl?: string; apiKey?: string },
      ) => {
        const providerId = (id ?? (await prompt("Provider ID: "))).trim();
        assertProviderId(providerId);
        if (providerId === "default") {
          throw new Error(
            "'default' is reserved for the built-in Llama provider",
          );
        }

        const providers = await getProviders();
        const inference = isRecord(providers.inference)
          ? (providers.inference as NonNullable<Providers["inference"]>)
          : {};
        if (Object.hasOwn(inference, providerId)) {
          throw new Error(`Inference provider already exists: ${providerId}`);
        }

        const baseURL = (
          options.baseUrl ?? (await prompt("Provider base URL: "))
        ).trim();
        const apiKey = (
          options.apiKey ?? (await prompt("Provider API key: "))
        ).trim();
        if (!baseURL.trim() || !apiKey.trim()) {
          throw new Error("Provider base URL and API key must not be empty");
        }

        await saveProviders({
          ...providers,
          inference: {
            ...inference,
            [providerId]: { baseURL, apiKey },
          },
        });
        console.log(pc.green(`Added inference provider: ${providerId}`));
      },
    ),
  );

providerCommand
  .command("delete <id>")
  .alias("remove")
  .description("delete a configured inference provider")
  .action(
    withProviderAction(async (id: string) => {
      assertProviderId(id);
      if (id === "default") {
        throw new Error("The built-in default provider cannot be deleted");
      }

      const providers = await getProviders();
      const inference = isRecord(providers.inference)
        ? (providers.inference as NonNullable<Providers["inference"]>)
        : {};
      if (!Object.hasOwn(inference, id)) {
        throw new Error(`Inference provider not found: ${id}`);
      }

      const remaining = { ...inference };
      delete remaining[id];
      await saveProviders({ ...providers, inference: remaining });
      if ((await loadSettings()).provider?.inference === id) {
        await setInferenceProvider("default");
        console.log(
          pc.yellow(`Deleted ${id}; selected provider reset to default`),
        );
      } else {
        console.log(pc.green(`Deleted inference provider: ${id}`));
      }
    }),
  );

function withProviderAction<T extends Array<unknown>>(
  action: (...args: T) => Promise<void>,
) {
  return async (...args: T) => {
    try {
      await action(...args);
    } catch (error) {
      console.error(
        pc.red(error instanceof Error ? error.message : String(error)),
      );
      process.exitCode = 1;
    } finally {
      finish();
      process.exit(process.exitCode ?? 0);
    }
  };
}

const printInferenceProvider = (
  id: string,
  baseURL: string,
  selected: string,
) => {
  const current = id === selected;
  const marker = current ? pc.green("*") : " ";
  const label = current ? pc.cyan(id) : id;
  console.log(
    `${marker} ${label} - ${baseURL}${current ? pc.dim(" (selected)") : ""}`,
  );
};

const assertProviderId = (id: string) => {
  if (!id.trim() || id !== id.trim()) {
    throw new Error(
      "Provider ID must not be empty or contain surrounding whitespace",
    );
  }
};

const isValidInferenceProvider = (provider: unknown) =>
  isRecord(provider) &&
  typeof provider.baseURL === "string" &&
  !!provider.baseURL &&
  typeof provider.apiKey === "string" &&
  !!provider.apiKey;

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

const defaultProvider = {
  baseURL: "http://localhost:9931/v1",
  apiKey: "llama.app",
};

const loadProvider = async (providerId: unknown) => {
  if (typeof providerId === "string" && providerId !== "default") {
    const provider = (await getProviders()).inference?.[providerId];
    if (
      isRecord(provider) &&
      typeof provider.baseURL === "string" &&
      provider.baseURL &&
      typeof provider.apiKey === "string" &&
      provider.apiKey
    ) {
      return {
        baseURL: provider.baseURL,
        apiKey: provider.apiKey,
      };
    }
  }
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
