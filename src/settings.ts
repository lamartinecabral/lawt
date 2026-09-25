import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type LawtSettings = {
  model?: string;
  reasoningEffort?: string | null;
};

const settingsPath = () =>
  path.join(process.env.HOME || os.homedir(), ".lawt", "settings.json");

export const loadSettings = async (): Promise<LawtSettings> => {
  try {
    const value: unknown = JSON.parse(
      await fs.readFile(settingsPath(), "utf8"),
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    const settings = value as Record<string, unknown>;
    const { model, reasoningEffort } = settings;
    return {
      ...(typeof model === "string" ? { model } : {}),
      ...(typeof reasoningEffort === "string" || reasoningEffort === null
        ? { reasoningEffort }
        : {}),
    };
  } catch (_) {
    return {};
  }
};

export const saveSettings = async (settings: {
  model: string;
  reasoningEffort: string | null | undefined;
}): Promise<void> => {
  const filePath = settingsPath();
  let existing: Record<string, unknown> = {};

  try {
    const value: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      existing = value as Record<string, unknown>;
    }
  } catch (_) {
    // A missing or malformed settings file can be replaced with valid settings.
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    `${JSON.stringify(
      {
        ...existing,
        model: settings.model,
        reasoningEffort: settings.reasoningEffort,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};
