import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createMockOllamaServer } from "./mock-server.js";
import { execaNode } from "execa";
import path from "node:path";
import os from "node:os";
import fs from "fs-extra";

const CLI_PATH = path.resolve("src/bin/cli.ts");

function runCli(args: string[], opts?: { timeout?: number; input?: string }) {
  return execaNode(CLI_PATH, args, {
    nodeOptions: ["--import", "tsx"],
    timeout: opts?.timeout ?? 15000,
    reject: false,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
    input: opts?.input,
  });
}

describe("CLI help output", () => {
  it("shows help with --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.stdout).toContain("minicode");
    expect(result.stdout).toContain("chat");
    expect(result.stdout).toContain("run");
    expect(result.stdout).toContain("tools");
    expect(result.exitCode).toBe(0);
  });

  it("shows version with --version", async () => {
    const result = await runCli(["--version"]);
    expect(result.stdout).toContain("1.0.0");
    expect(result.exitCode).toBe(0);
  });
});

describe("offline host failure", () => {
  it("exits with code 1 and friendly message when host is unreachable", async () => {
    const result = await runCli([
      "--host",
      "http://127.0.0.1:19999",
      "run",
      "hello",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/connect|ollama|ECONNREFUSED/i);
  });
});

describe("tools command", () => {
  it("lists tools in text mode", async () => {
    const result = await runCli(["tools"]);
    expect(result.stdout).toContain("list_dir");
    expect(result.stdout).toContain("read_file");
    expect(result.stdout).toContain("write_file");
    expect(result.stdout).toContain("grep_search");
    expect(result.exitCode).toBe(0);
  });

  it("lists tools in json mode", async () => {
    const result = await runCli(["--json", "tools"]);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(10);
    expect(result.exitCode).toBe(0);
  });
});

describe("with mock Ollama server", () => {
  const mock = createMockOllamaServer();
  let host: string;

  beforeAll(async () => {
    host = await mock.start();
  });

  afterAll(async () => {
    await mock.stop();
  });

  it("single run task returns deterministic mocked response", async () => {
    mock.queueResponse({ content: "Hello from mock model!" });

    const result = await runCli([
      "--host", host,
      "--model", "test-model:latest",
      "run",
      "Say hello",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Hello from mock model!");
  });

  it("json mode returns structured output", async () => {
    mock.queueResponse({ content: "JSON test response" });

    const result = await runCli([
      "--host", host,
      "--model", "test-model:latest",
      "--json",
      "run",
      "Test task",
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.finalResponse).toBe("JSON test response");
    expect(Array.isArray(parsed.steps)).toBe(true);
    expect(Array.isArray(parsed.toolCalls)).toBe(true);
  });

  it("forwards --think level to Ollama chat requests", async () => {
    mock.resetLastChatRequest();
    mock.queueResponse({ content: "Thinking level enabled" });

    const result = await runCli([
      "--host", host,
      "--model", "test-model:latest",
      "--think", "high",
      "run",
      "Think deeply before answering",
    ]);

    expect(result.exitCode).toBe(0);
    expect(mock.getLastChatRequest()?.think).toBe("high");
  });

  it("missing model triggers pull flow", async () => {
    mock.setModelName("other-model:latest");
    mock.resetPull();
    mock.queueResponse({ content: "After pull" });

    // This will fail because our mock pull doesn't actually make the model
    // appear in the list, but we can verify pull was attempted
    const _result = await runCli([
      "--host", host,
      "--model", "needed-model:latest",
      "run",
      "Test",
    ]);
    // The pull should have been requested
    expect(mock.wasPullRequested()).toBe(true);

    // Restore model name
    mock.setModelName("test-model:latest");
  });

  it("chat mode prints thinking and tool-call indicators", async () => {
    const chatSandbox = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-chat-e2e-"));
    try {
      mock.queueResponse({
        content: "",
        thinking: "I should create the requested file first.",
        tool_calls: [
          {
            function: {
              name: "write_file",
              arguments: { path: "from-chat.txt", content: "chat output" },
            },
          },
        ],
      });
      mock.queueResponse({
        content: "Created from-chat.txt.",
        thinking: "Task is complete.",
      });

      const result = await runCli(
        [
          "--host",
          host,
          "--model",
          "test-model:latest",
          "--cwd",
          chatSandbox,
          "chat",
        ],
        {
          input: "Create from-chat.txt with chat output\nexit\n",
          timeout: 20000,
        },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("think>");
      expect(result.stdout).toContain("tool>");
      expect(result.stdout).toContain("Created from-chat.txt.");
      expect(await fs.readFile(path.join(chatSandbox, "from-chat.txt"), "utf-8")).toBe(
        "chat output",
      );
    } finally {
      await fs.remove(chatSandbox);
    }
  });
});

describe("autonomous tool-calling flow", () => {
  const mock = createMockOllamaServer();
  let host: string;
  let sandbox: string;

  beforeAll(async () => {
    host = await mock.start();
  });

  afterAll(async () => {
    await mock.stop();
  });

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-e2e-"));
  });

  afterEach(async () => {
    await fs.remove(sandbox);
  });

  it("creates a file through tool calls", async () => {
    // Step 1: model calls write_file
    mock.queueResponse({
      content: "",
      tool_calls: [
        {
          function: {
            name: "write_file",
            arguments: { path: "hello.txt", content: "Hello World!" },
          },
        },
      ],
    });
    // Step 2: model gives final answer
    mock.queueResponse({ content: "Created hello.txt successfully." });

    const result = await runCli([
      "--host", host,
      "--model", "test-model:latest",
      "--cwd", sandbox,
      "run",
      "Create hello.txt with Hello World",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Created hello.txt");

    const fileContent = await fs.readFile(path.join(sandbox, "hello.txt"), "utf-8");
    expect(fileContent).toBe("Hello World!");
  });

  it("blocks path traversal in tool calls", async () => {
    mock.queueResponse({
      content: "",
      tool_calls: [
        {
          function: {
            name: "write_file",
            arguments: { path: "../../../tmp/evil.txt", content: "hacked" },
          },
        },
      ],
    });
    mock.queueResponse({ content: "Done" });

    const result = await runCli([
      "--host", host,
      "--model", "test-model:latest",
      "--cwd", sandbox,
      "run",
      "Write outside sandbox",
    ]);

    expect(result.exitCode).toBe(0);
    // File should NOT exist outside sandbox
    expect(await fs.pathExists(path.join(os.tmpdir(), "evil.txt"))).toBe(false);
  });

  it("reads and edits files through multi-step tool calls", async () => {
    await fs.writeFile(path.join(sandbox, "data.txt"), "old value");

    // Step 1: model reads the file
    mock.queueResponse({
      content: "",
      tool_calls: [
        {
          function: {
            name: "read_file",
            arguments: { path: "data.txt" },
          },
        },
      ],
    });
    // Step 2: model replaces in file
    mock.queueResponse({
      content: "",
      tool_calls: [
        {
          function: {
            name: "replace_in_file",
            arguments: { path: "data.txt", search: "old value", replace: "new value" },
          },
        },
      ],
    });
    // Step 3: final answer
    mock.queueResponse({ content: "Updated data.txt" });

    const result = await runCli([
      "--host", host,
      "--model", "test-model:latest",
      "--cwd", sandbox,
      "run",
      "Update data.txt",
    ]);

    expect(result.exitCode).toBe(0);
    const content = await fs.readFile(path.join(sandbox, "data.txt"), "utf-8");
    expect(content).toBe("new value");
  });

});
