import { describe, expect, it } from "vitest";
import { execaNode } from "execa";
import { resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dirname, "../src/cli.mjs");

describe("CLI e2e", () => {
  it("prints help text", async () => {
    const { stdout } = await execaNode(CLI_PATH, ["--help"]);
    expect(stdout).toContain("CLI AI agent powered by Ollama");
    expect(stdout).toContain("-m, --model");
    expect(stdout).toContain("-p, --prompt");
    expect(stdout).toContain("-t, --think");
    expect(stdout).toContain("-s, --system");
    expect(stdout).toContain("-c, --context");
  });

  it("prints version", async () => {
    const { stdout } = await execaNode(CLI_PATH, ["--version"]);
    expect(stdout.trim()).toBe("1.0.0");
  });

  it("rejects invalid --think value", async () => {
    try {
      await execaNode(CLI_PATH, ["--think", "invalid"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error.stderr || error.message).toContain(
        "Invalid value for --think",
      );
    }
  });

  it("accepts --think true", async () => {
    // Passing --think true with --help so the process exits without
    // needing an Ollama connection.
    const { stdout } = await execaNode(CLI_PATH, ["--think", "true", "--help"]);
    expect(stdout).toContain("CLI AI agent");
  });

  it("accepts --think high", async () => {
    const { stdout } = await execaNode(CLI_PATH, ["--think", "high", "--help"]);
    expect(stdout).toContain("CLI AI agent");
  });

  it("shows program name as minicode", async () => {
    const { stdout } = await execaNode(CLI_PATH, ["--help"]);
    expect(stdout).toContain("minicode");
  });
});
