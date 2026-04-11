import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Ollama } from "ollama";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { getSystemPrompt, runChatTurn } from "../../src/agent/loop.js";
import type { AgentOptions } from "../../src/lib/types.js";

interface MockAssistantMessage {
  role: "assistant";
  content: string;
  thinking?: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
}

describe("runChatTurn", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-chat-turn-"));
  });

  afterEach(async () => {
    await fs.remove(sandbox);
  });

  it("executes tool calls and returns the final assistant response", async () => {
    const responses: MockAssistantMessage[] = [
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            function: {
              name: "write_file",
              arguments: { path: "chat.txt", content: "hello from chat" },
            },
          },
        ],
      },
      {
        role: "assistant",
        content: "Done creating chat.txt.",
      },
    ];

    const chatRequests: Array<Record<string, unknown>> = [];
    const client = {
      async chat(request: Record<string, unknown>) {
        chatRequests.push(request);
        const next = responses.shift();
        if (!next) {
          throw new Error("No queued response");
        }
        return { message: next };
      },
    } as unknown as Ollama;

    const opts: AgentOptions = {
      model: "test-model:latest",
      host: "http://127.0.0.1:11434",
      cwd: sandbox,
      maxSteps: 5,
      think: undefined,
      json: false,
      verbose: false,
    };

    const messages = [
      { role: "system" as const, content: getSystemPrompt() },
      { role: "user" as const, content: "Create chat.txt with hello from chat" },
    ];

    const result = await runChatTurn(client, messages, opts);

    expect(result.response).toBe("Done creating chat.txt.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe("write_file");
    expect(result.errors).toEqual([]);
    expect(result.events).toEqual([
      {
        type: "tool_call",
        name: "write_file",
        args: { path: "chat.txt", content: "hello from chat" },
      },
    ]);
    expect(await fs.readFile(path.join(sandbox, "chat.txt"), "utf-8")).toBe("hello from chat");
    expect(Array.isArray(chatRequests[0]?.["tools"])).toBe(true);
    expect(messages.some((m) => m.role === "tool")).toBe(true);
  });

  it("captures thinking and tool-call events in order", async () => {
    const responses: MockAssistantMessage[] = [
      {
        role: "assistant",
        content: "",
        thinking: "I should write a file before responding.",
        tool_calls: [
          {
            function: {
              name: "write_file",
              arguments: { path: "events.txt", content: "event test" },
            },
          },
        ],
      },
      {
        role: "assistant",
        content: "Done.",
        thinking: "Now I can provide the final answer.",
      },
    ];

    const client = {
      async chat() {
        const next = responses.shift();
        if (!next) {
          throw new Error("No queued response");
        }
        return { message: next };
      },
    } as unknown as Ollama;

    const opts: AgentOptions = {
      model: "test-model:latest",
      host: "http://127.0.0.1:11434",
      cwd: sandbox,
      maxSteps: 5,
      think: undefined,
      json: false,
      verbose: false,
    };

    const messages = [
      { role: "system" as const, content: getSystemPrompt() },
      { role: "user" as const, content: "Create events.txt" },
    ];

    const result = await runChatTurn(client, messages, opts);

    expect(result.response).toBe("Done.");
    expect(result.events).toEqual([
      { type: "thinking", text: "I should write a file before responding." },
      {
        type: "tool_call",
        name: "write_file",
        args: { path: "events.txt", content: "event test" },
      },
      { type: "thinking", text: "Now I can provide the final answer." },
    ]);
    expect(await fs.readFile(path.join(sandbox, "events.txt"), "utf-8")).toBe("event test");
  });
});
