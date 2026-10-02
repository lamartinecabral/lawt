import fs from "node:fs";
import path from "node:path";

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

let provider: Promise<{
  baseURL?: string;
  apiKey?: string;
  webSearch?: {
    ollama?: {
      apiKey?: string;
    };
    tavily?: {
      apiKey?: string;
    };
    local?: {
      chromePath?: string;
    };
  };
}>;

export const getProvider = async () => {
  if (provider) return provider;
  provider = (async () => {
    try {
      const obj = (await import(`${process.env.HOME}/.lawt/provider.ts`))
        .default;
      return obj && typeof obj === "object" ? obj : {};
    } catch (_) {
      return {};
    }
  })();
  return provider;
};
