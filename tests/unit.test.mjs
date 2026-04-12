import { describe, it, expect } from "vitest";
import { exec } from "node:child_process";

// Since cli.mjs doesn't export its utilities, we test them
// by re-implementing the same logic to validate expected behavior.
// The e2e tests verify the integrated CLI behavior.

describe("ellipsis", () => {
  // Mirrors the ellipsis function in src/cli.mjs
  const ellipsis = (str = "", len = 50) => {
    if (str.length > len) return str.substring(0, len - 1) + "…";
    return str;
  };

  it("returns the original string if within length", () => {
    expect(ellipsis("hello", 10)).toBe("hello");
  });

  it("truncates and adds ellipsis when string exceeds length", () => {
    expect(ellipsis("hello world", 5)).toBe("hell…");
  });

  it("returns exact string when length equals limit", () => {
    expect(ellipsis("hello", 5)).toBe("hello");
  });

  it("handles empty string", () => {
    expect(ellipsis("", 10)).toBe("");
  });

  it("handles undefined input with default", () => {
    expect(ellipsis(undefined, 10)).toBe("");
  });

  it("uses default length of 50", () => {
    const long = "a".repeat(60);
    expect(ellipsis(long)).toBe("a".repeat(49) + "…");
  });
});

describe("parseThinkOption logic", () => {
  // Mirrors the parseThinkOption function in src/cli.mjs
  function parseThinkOption(value) {
    if (typeof value === "boolean") return value;
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (["high", "medium", "low"].includes(normalized)) return normalized;
    throw new Error(
      `Invalid value for --think: ${value}. Expected true, false, high, medium, or low.`,
    );
  }

  it('parses "true" to boolean true', () => {
    expect(parseThinkOption("true")).toBe(true);
  });

  it('parses "false" to boolean false', () => {
    expect(parseThinkOption("false")).toBe(false);
  });

  it("passes through boolean true", () => {
    expect(parseThinkOption(true)).toBe(true);
  });

  it("passes through boolean false", () => {
    expect(parseThinkOption(false)).toBe(false);
  });

  it('parses "high"', () => {
    expect(parseThinkOption("high")).toBe("high");
  });

  it('parses "medium"', () => {
    expect(parseThinkOption("medium")).toBe("medium");
  });

  it('parses "low"', () => {
    expect(parseThinkOption("low")).toBe("low");
  });

  it("is case-insensitive", () => {
    expect(parseThinkOption("TRUE")).toBe(true);
    expect(parseThinkOption("High")).toBe("high");
  });

  it("throws on invalid value", () => {
    expect(() => parseThinkOption("invalid")).toThrow(
      "Invalid value for --think",
    );
  });
});

describe("run_bash_command tool logic", () => {
  // Mirrors the tool execution logic in src/cli.mjs

  const execute = async ({ command }) => {
    try {
      const { stdout, stderr } = await new Promise((res, rej) =>
        exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
          if (error) rej(error);
          res({ stderr, stdout });
        }),
      );
      if (stderr && !stdout) {
        return `Command executed with warnings/stderr:\n${stderr.trim()}`;
      }
      return stdout.trim() || "Command executed successfully with no output.";
    } catch (error) {
      return `Execution Failed.\nExit Code: ${error.code}\nError: ${error.message}`;
    }
  };

  it("executes a simple command and returns stdout", async () => {
    const result = await execute({ command: "echo hello" });
    expect(result).toBe("hello");
  });

  it('returns "no output" message for silent commands', async () => {
    const result = await execute({ command: "true" });
    expect(result).toBe("Command executed successfully with no output.");
  });

  it("returns error info for failing commands", async () => {
    const result = await execute({ command: "false" });
    expect(result).toContain("Execution Failed.");
  });

  it("returns stderr when only stderr is produced", async () => {
    const result = await execute({ command: "echo err >&2" });
    expect(result).toContain("Command executed with warnings/stderr:");
    expect(result).toContain("err");
  });

  it("returns stdout even when stderr is also present", async () => {
    const result = await execute({
      command: "echo out && echo err >&2",
    });
    expect(result).toBe("out");
  });
});
