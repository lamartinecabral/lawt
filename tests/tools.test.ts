import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { executeToolCall, toolsToOllamaFormat } from "../src/tools/index.ts";

const originalCwd = process.cwd();

let workspaceDir = "";

function expectSuccess(result: Awaited<ReturnType<typeof executeToolCall>>) {
  expect(result.result).toMatchObject({ success: true });
  if (!result.result.success) {
    throw new Error(`Expected success, got failure: ${result.result.error}`);
  }
  return result.result.data;
}

function expectFailure(result: Awaited<ReturnType<typeof executeToolCall>>) {
  expect(result.result).toMatchObject({ success: false });
  if (result.result.success) {
    throw new Error("Expected failure, got success");
  }
  return result.result.error;
}

describe("tool registry", () => {
  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-tools-"));
    process.chdir(workspaceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("exports the active tool set", () => {
    expect(toolsToOllamaFormat().map((tool) => tool.function.name)).toEqual([
      "list_directory",
      "read_file",
      "create_file",
      "replace_string_in_file",
      "file_search",
      "grep_search",
      "run_shell_command",
    ]);
  });

  it("searches file contents with grep_search", async () => {
    await executeToolCall("create_file", {
      file_path: "notes/example.txt",
      content: "alpha\nbeta\ngamma\n",
    });

    const result = await executeToolCall("grep_search", {
      query: "beta",
      isRegexp: false,
      includePattern: "notes/**",
    });

    expect(expectSuccess(result)).toContain("notes/example.txt:2:beta");
  });

  it("can create, update, read, and search files inside the workspace", async () => {
    const created = await executeToolCall("create_file", {
      file_path: "notes/example.txt",
      content: "alpha\nbeta\ngamma\n",
    });

    expectSuccess(created);
    await expect(
      fs.readFile(path.join(workspaceDir, "notes/example.txt"), "utf-8"),
    ).resolves.toBe("alpha\nbeta\ngamma\n");

    const updated = await executeToolCall("replace_string_in_file", {
      file_path: "notes/example.txt",
      old_text: "beta",
      new_text: "beta-updated",
    });

    expectSuccess(updated);

    const read = await executeToolCall("read_file", {
      file_path: "notes/example.txt",
      position: 1,
      line_count: 3,
    });

    expect(expectSuccess(read)).toBe("alpha\nbeta-updated\ngamma");

    const listing = await executeToolCall("list_directory", { path: "notes" });
    expect(expectSuccess(listing)).toEqual("example.txt");

    const files = await executeToolCall("file_search", {
      query: "notes/**/*.txt",
    });
    expect(expectSuccess(files)).toEqual("notes/example.txt");

    const grep = await executeToolCall("grep_search", {
      query: "beta-updated",
      isRegexp: false,
      includePattern: "notes/**",
    });

    expect(expectSuccess(grep)).toEqual("notes/example.txt:2:beta-updated");
  });

  it("executes shell commands in the current workspace", async () => {
    const result = await executeToolCall(
      "run_shell_command",
      JSON.stringify({ command: "printf 'hello from shell'" }),
    );

    expect(expectSuccess(result)).toEqual(
      JSON.stringify({
        stdout: "hello from shell",
        stderr: "",
      }),
    );
  });

  it("rejects paths that lexically escape the workspace", async () => {
    const result = await executeToolCall("read_file", {
      file_path: "../outside.txt",
      position: 1,
      line_count: 1,
    });

    expect(expectFailure(result)).toContain("outside the workspace");
  });
});
