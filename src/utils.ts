import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decrypt, encrypt } from "@lamartinecabral/sekret";

const inferenceApiKeyPrefix = "lawt:v1:";
const inferenceApiKeyPassword = "lawt-inference-provider-api-key-sekret-v1";

type Abortable = { abort: () => unknown };
export const Abortables = {
  entries: new Set<Abortable>(),
  get size() {
    return this.entries.size;
  },
  add: function (entry: Abortable) {
    this.entries.add(entry);
  },
  delete: function (entry: Abortable) {
    if (this.entries.has(entry)) this.entries.delete(entry);
  },
  abort: function () {
    for (const entry of this.entries) entry.abort();
    this.entries.clear();
  },
};

export const sleep = async (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export const ellipsis = (str = "", len = 50, lines = 0) => {
  const result =
    len && str.length > len ? `${str.substring(0, len - 1)}…` : str;
  if (!lines) return result;
  const resultLines = result.split("\n");
  if (resultLines.length <= lines) return result;
  return result.split("\n").slice(0, lines).concat("…").join("\n");
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const stringify = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_) {
      // ignore
    }
  }
  return String(value);
};

export const projectRoot = path.resolve(
  path.dirname(fs.realpathSync(process.argv[1])),
  "..",
);

export type InferenceProvider = {
  baseURL: string;
  apiKey: string;
};

export type Providers = {
  inference?: Record<string, InferenceProvider>;
  webSearch?: {
    ollama?: {
      apiKey?: string;
    };
    tavily?: {
      apiKey?: string;
    };
    puppeteer?: {
      chromePath?: string;
    };
  };
};

const providersPath = () =>
  path.join(process.env.HOME || os.homedir(), ".lawt", "providers.json");

export const getProviders = async (): Promise<Providers> => {
  let value: unknown;
  try {
    value = JSON.parse(await fsp.readFile(providersPath(), "utf8"));
  } catch (_) {
    return {};
  }

  if (!isRecord(value)) return {};

  const providers = value as Providers;
  if (!isRecord(providers.inference)) return providers;

  const inference = Object.fromEntries(
    await Promise.all(
      Object.entries(providers.inference).map(async ([id, provider]) => {
        if (
          !isRecord(provider) ||
          typeof provider.apiKey !== "string" ||
          !provider.apiKey.startsWith(inferenceApiKeyPrefix)
        ) {
          return [id, provider];
        }

        return [
          id,
          {
            ...provider,
            apiKey: await decrypt(
              provider.apiKey.slice(inferenceApiKeyPrefix.length),
              inferenceApiKeyPassword,
            ),
          },
        ];
      }),
    ),
  );

  return { ...providers, inference } as Providers;
};

export const saveProviders = async (providers: Providers): Promise<void> => {
  const filePath = providersPath();
  const inference = providers.inference
    ? Object.fromEntries(
        await Promise.all(
          Object.entries(providers.inference).map(async ([id, provider]) => {
            if (
              !isRecord(provider) ||
              typeof provider.apiKey !== "string" ||
              provider.apiKey.startsWith(inferenceApiKeyPrefix)
            ) {
              return [id, provider];
            }

            return [
              id,
              {
                ...provider,
                apiKey: `${inferenceApiKeyPrefix}${await encrypt(
                  provider.apiKey,
                  inferenceApiKeyPassword,
                  { deterministic: true },
                )}`,
              },
            ];
          }),
        ),
      )
    : undefined;

  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(
    filePath,
    `${JSON.stringify(
      { ...providers, ...(inference ? { inference } : {}) },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

export class RateLimiter {
  private nextAvailableTime = 0;
  private minInterval: number;

  constructor(minInterval: number) {
    this.minInterval = minInterval;
  }

  wait(): Promise<void> {
    const now = Date.now();
    const waitTime = Math.max(0, this.nextAvailableTime - now);
    this.nextAvailableTime = now + waitTime + this.minInterval;
    return sleep(waitTime);
  }
}
