import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { loadSettings, saveSettings } from "../src/settings.ts";

const originalHome = process.env.HOME;
let homeDir = "";

describe("settings", () => {
  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "lawt-settings-"));
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  it("loads and saves the last used values", async () => {
    await saveSettings({ model: "test-model", reasoningEffort: "high" });

    assert.deepStrictEqual(await loadSettings(), {
      model: "test-model",
      reasoningEffort: "high",
    });
    assert.ok(await fs.stat(path.join(homeDir, ".lawt", "settings.json")));
  });

  it("ignores malformed settings", async () => {
    await fs.mkdir(path.join(homeDir, ".lawt"));
    await fs.writeFile(
      path.join(homeDir, ".lawt", "settings.json"),
      "not json",
    );

    assert.deepStrictEqual(await loadSettings(), {});
  });
});
