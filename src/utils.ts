import fs from "node:fs";
import path from "node:path";

export const abortables = new Set<{ abort: () => unknown }>();

export const ellipsis = (str = "", len = 50) => {
  if (str.length > len) return `${str.substring(0, len - 1)}…`;
  return str;
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
