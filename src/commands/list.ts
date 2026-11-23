import type { Command } from "commander";
import OpenAI from "openai";
import pc from "picocolors";
import { finish } from "../io.ts";
import { loadSettings } from "../settings.ts";
import { getProviders, isRecord } from "../utils.ts";

export const setListCommand = (program: Command) => {
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
};

export const showAvailableModels = async (
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

const defaultProvider = {
  baseURL: "http://localhost:9931/v1",
  apiKey: "llama.app",
};

export const loadProvider = async (providerId: unknown) => {
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
