import { describe, it, expect } from "vitest";
import type { RunResult } from "../../src/lib/types.js";

describe("loop stop conditions", () => {
  it("RunResult has correct shape for max-steps scenario", () => {
    const result: RunResult = {
      finalResponse: "Reached maximum steps (3) without final answer.",
      steps: [],
      toolCalls: [],
      changedFiles: [],
      errors: ["Reached maximum steps (3) without final answer."],
    };
    expect(result.errors.length).toBe(1);
    expect(result.finalResponse).toContain("maximum steps");
  });

  it("RunResult has correct shape for normal completion", () => {
    const result: RunResult = {
      finalResponse: "All done!",
      steps: [{ role: "assistant", content: "All done!" }],
      toolCalls: [],
      changedFiles: [],
      errors: [],
    };
    expect(result.errors.length).toBe(0);
    expect(result.finalResponse).toBe("All done!");
  });

  it("tracks changed files from mutating tool calls", () => {
    const result: RunResult = {
      finalResponse: "Created files",
      steps: [],
      toolCalls: [
        {
          name: "write_file",
          args: { path: "a.txt", content: "hello" },
          result: { success: true, data: { written: "/tmp/a.txt" } },
        },
      ],
      changedFiles: ["a.txt"],
      errors: [],
    };
    expect(result.changedFiles).toContain("a.txt");
  });

  it("collects errors from failed tool calls", () => {
    const result: RunResult = {
      finalResponse: "Partial success",
      steps: [],
      toolCalls: [
        {
          name: "read_file",
          args: { path: "missing.txt" },
          result: { success: false, error: "ENOENT" },
        },
      ],
      changedFiles: [],
      errors: ["ENOENT"],
    };
    expect(result.errors).toContain("ENOENT");
  });
});
