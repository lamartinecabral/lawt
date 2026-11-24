import type { Command } from "commander";
import pc from "picocolors";
import type { Providers } from "../utils/index.ts";
import { getProviders, isRecord, saveProviders } from "../utils/index.ts";
import { finish, prompt } from "../utils/io.ts";
import { loadSettings, setInferenceProvider } from "../utils/settings.ts";

export const setProviderCommand = (program: Command) => {
  const providerCommand = program
    .command("provider")
    .description("manage inference providers");

  setListCommand(providerCommand);
  setSelectCommand(providerCommand);
  setAddCommand(providerCommand);
  setRemoveCommand(providerCommand);
};

const setListCommand = (providerCommand: Command) => {
  providerCommand
    .command("list")
    .alias("ls")
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
};

const setSelectCommand = (providerCommand: Command) => {
  providerCommand
    .command("select <id>")
    .alias("set")
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
};

const setAddCommand = (providerCommand: Command) => {
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
};

const setRemoveCommand = (providerCommand: Command) => {
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
};

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
