import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type OpenAI from "openai";
import type { GenerateResult } from "../src/generate.ts";
import { generate } from "../src/generate.ts";
import { Session } from "../src/session.ts";

type StreamChunk = {
  choices: Array<{
    delta: Record<string, unknown>;
    finish_reason: string | null;
  }>;
  usage?: Record<string, unknown>;
};

const sampleDir = path.join(import.meta.dirname, "samples");
const samples = [
  {
    name: "llamacpp",
    reasoningField: "reasoning_content",
    expectedToolArguments: '{"path":"./"}',
  },
  {
    name: "ollama",
    reasoningField: "reasoning",
    expectedToolArguments: '{"path":"."}',
  },
  {
    name: "openrouter",
    reasoningField: "reasoning",
    expectedToolArguments: '{"path":"."}',
  },
] as const;

const readSample = (name: string): StreamChunk[] =>
  fs
    .readFileSync(path.join(sampleDir, `stream-${name}.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as StreamChunk);

const createClient = (chunks: StreamChunk[]) => {
  let request: unknown;
  const client = {
    chat: {
      completions: {
        create: async (params: unknown) => {
          request = params;
          return {
            async *[Symbol.asyncIterator]() {
              yield* chunks;
            },
          };
        },
      },
    },
  } as unknown as OpenAI;

  return {
    client,
    getRequest: () => request,
  };
};

describe("generate stream samples", () => {
  for (const sample of samples) {
    it(`normalizes the ${sample.name} stream`, async () => {
      const chunks = readSample(sample.name);
      const { client, getRequest } = createClient(chunks);
      const results: GenerateResult[] = [];

      for await (const result of generate({
        client,
        model: "test-model",
        session: new Session([]),
        tools: [],
        reasoningEffort: undefined,
        otherSettings: {},
        stream: true,
        signal: new AbortController().signal,
      })) {
        results.push(result);
      }

      const reasoning = chunks
        .flatMap((chunk) => chunk.choices)
        .map((choice) => choice.delta[sample.reasoningField])
        .filter((value): value is string => typeof value === "string")
        .join("");
      const reasoningResults = results.filter(
        (result) => result[sample.reasoningField],
      );
      const toolCalls = results.flatMap((result) => result.tool_calls ?? []);
      const usage = chunks.find((chunk) => chunk.usage)?.usage;

      assert.deepStrictEqual(getRequest(), {
        model: "test-model",
        messages: [],
        tools: [],
        reasoning_effort: undefined,
        stream_options: { include_usage: true },
        stream: true,
      });
      assert.equal(
        reasoningResults
          .map((result) => result[sample.reasoningField])
          .join(""),
        reasoning,
      );
      assert.equal(toolCalls.length, 1);
      assert.equal(toolCalls[0].function.name, "list_directory");
      assert.equal(
        toolCalls[0].function.arguments,
        sample.expectedToolArguments,
      );
      assert.deepStrictEqual(
        results.filter((result) => result.finish_reason),
        [{ finish_reason: "tool_calls" }],
      );
      assert.deepStrictEqual(
        results.find((result) => result.usage),
        { usage },
      );
    });
  }
});
