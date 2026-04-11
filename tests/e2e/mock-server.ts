import http from "node:http";
import type { AddressInfo } from "node:net";

interface MockToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface MockResponse {
  content: string;
  tool_calls?: MockToolCall[];
}

/**
 * Lightweight mock Ollama HTTP server for e2e tests.
 * Queues responses that are returned in order for /api/chat calls.
 */
export function createMockOllamaServer() {
  const responseQueue: MockResponse[] = [];
  let modelName = "test-model:latest";
  let pullRequested = false;
  let lastChatRequest: Record<string, unknown> | null = null;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      // GET /api/tags — list models
      if (req.url === "/api/tags" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ models: [{ name: modelName }] }));
        return;
      }

      // POST /api/pull — pull model
      if (req.url === "/api/pull" && req.method === "POST") {
        pullRequested = true;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "success" }));
        return;
      }

      // POST /api/chat — chat completion
      if (req.url === "/api/chat" && req.method === "POST") {
        const rawBody = Buffer.concat(chunks).toString("utf-8");
        if (rawBody.length > 0) {
          try {
            lastChatRequest = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            lastChatRequest = null;
          }
        } else {
          lastChatRequest = null;
        }

        const nextResponse = responseQueue.shift();
        if (!nextResponse) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: { role: "assistant", content: "No more queued responses" },
              done: true,
            }),
          );
          return;
        }

        const chatResponse: Record<string, unknown> = {
          message: {
            role: "assistant",
            content: nextResponse.content,
            ...(nextResponse.tool_calls
              ? {
                  tool_calls: nextResponse.tool_calls.map((tc) => ({
                    function: {
                      name: tc.function.name,
                      arguments: tc.function.arguments,
                    },
                  })),
                }
              : {}),
          },
          done: true,
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(chatResponse));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });
  });

  return {
    server,
    queueResponse(resp: MockResponse) {
      responseQueue.push(resp);
    },
    setModelName(name: string) {
      modelName = name;
    },
    wasPullRequested() {
      return pullRequested;
    },
    resetPull() {
      pullRequested = false;
    },
    getLastChatRequest() {
      return lastChatRequest;
    },
    resetLastChatRequest() {
      lastChatRequest = null;
    },
    async start(): Promise<string> {
      return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address() as AddressInfo;
          resolve(`http://127.0.0.1:${addr.port}`);
        });
      });
    },
    async stop(): Promise<void> {
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
