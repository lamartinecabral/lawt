import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { executeToolCall, toolsToOpenAIFormat } from "../src/tools/index.ts";

const originalCwd = process.cwd();
const originalHome = process.env.HOME;

let workspaceDir = "";
let homeDir = "";

function expectSuccess(result: Awaited<ReturnType<typeof executeToolCall>>) {
  assert.partialDeepStrictEqual(result.result, { success: true });
  if (!result.result.success) {
    throw new Error(`Expected success, got failure: ${result.result.error}`);
  }
  return result.result.data;
}

function expectFailure(result: Awaited<ReturnType<typeof executeToolCall>>) {
  assert.partialDeepStrictEqual(result.result, { success: false });
  if (result.result.success) {
    throw new Error("Expected failure, got success");
  }
  return result.result.error;
}

describe("tool registry", () => {
  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "lawt-tools-"));
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "lawt-home-"));
    process.chdir(workspaceDir);
    process.env.HOME = homeDir;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
    if (homeDir) {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("exports the active tool set", async () => {
    const tools = await toolsToOpenAIFormat();
    assert.deepStrictEqual(
      tools.map((tool) => tool.function.name),
      [
        "list_directory",
        "read_file",
        "create_file",
        "replace_string_in_file",
        "file_search",
        "grep_search",
        "run_shell_command",
        "web_search",
        "fetch_page_content",
      ],
    );
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

    assert.ok(expectSuccess(result).includes("notes/example.txt:2:beta"));
  });

  it("can create, update, read, and search files inside the workspace", async () => {
    const created = await executeToolCall("create_file", {
      file_path: "notes/example.txt",
      content: "alpha\nbeta\ngamma\n",
    });

    expectSuccess(created);
    await fs
      .readFile(path.join(workspaceDir, "notes/example.txt"), "utf-8")
      .then((content) => {
        assert.strictEqual(content, "alpha\nbeta\ngamma\n");
      });

    const updated = await executeToolCall("replace_string_in_file", {
      file_path: "notes/example.txt",
      old_text: "beta",
      new_text: "beta-updated",
    });

    expectSuccess(updated);

    const read = await executeToolCall("read_file", {
      file_path: "notes/example.txt",
      start_line: 1,
      end_line: 3,
    });

    assert.strictEqual(expectSuccess(read), "alpha\nbeta-updated\ngamma");

    const listing = await executeToolCall("list_directory", { path: "notes" });
    assert.strictEqual(expectSuccess(listing), "example.txt");

    const files = await executeToolCall("file_search", {
      query: "notes/**/*.txt",
    });
    assert.strictEqual(expectSuccess(files), "notes/example.txt");

    const grep = await executeToolCall("grep_search", {
      query: "beta-updated",
      isRegexp: false,
      includePattern: "notes/**",
    });

    assert.strictEqual(expectSuccess(grep), "notes/example.txt:2:beta-updated");
  });

  it("executes shell commands in the current workspace", async () => {
    const result = await executeToolCall("run_shell_command", {
      command: "printf 'hello from shell'",
    });

    assert.strictEqual(
      expectSuccess(result),
      JSON.stringify({
        stdout: "hello from shell",
      }),
    );
  });

  it("rejects paths that lexically escape the workspace", async () => {
    const result = await executeToolCall("read_file", {
      file_path: "../outside.txt",
      start_line: 1,
      end_line: 1,
    });

    assert.ok(expectFailure(result).includes("outside the workspace"));
  });
});
