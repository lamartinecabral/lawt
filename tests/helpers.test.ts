import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendThinking, getThinking } from "../src/thinking.ts";
import { ellipsis, stringify } from "../src/utils.ts";

describe("thinking helpers", () => {
  it("appends both supported reasoning fields", () => {
    const thinking: { reasoning?: string; reasoning_content?: string } = {};
    appendThinking(thinking, { reasoning: "first" } as never);
    assert.deepStrictEqual(thinking, { reasoning: "first" });

    appendThinking(thinking, { reasoning: " second" } as never);
    assert.deepStrictEqual(thinking, { reasoning: "first second" });

    const reasoningContent: { reasoning_content?: string } = {};
    appendThinking(reasoningContent, { reasoning_content: "details" } as never);
    assert.deepStrictEqual(reasoningContent, { reasoning_content: "details" });

    assert.strictEqual(appendThinking({}, { content: "ordinary" }), undefined);
  });

  it("accepts empty strings and ignores non-string reasoning values", () => {
    const thinking: { reasoning?: string; reasoning_content?: string } = {};
    appendThinking(thinking, { reasoning: "" } as never);
    assert.deepStrictEqual(thinking, { reasoning: "" });

    appendThinking(thinking, { reasoning: 42 } as never);
    appendThinking(thinking, { reasoning_content: false } as never);
    assert.deepStrictEqual(thinking, { reasoning: "" });
  });

  it("reads reasoning from messages and ignores other values", () => {
    assert.strictEqual(getThinking({ reasoning: 42 }), undefined);
    assert.strictEqual(getThinking({ reasoning_content: "trace" }), "trace");
    assert.strictEqual(getThinking({ reasoning: "" }), "");
    assert.strictEqual(
      getThinking({ reasoning: 42, reasoning_content: "trace" }),
      "trace",
    );
    assert.strictEqual(getThinking({ content: "answer" }), undefined);
    assert.strictEqual(getThinking(null), undefined);
    assert.strictEqual(getThinking("text"), undefined);
  });
});

describe("utility helpers", () => {
  it("truncates long strings and stringifies values", () => {
    assert.strictEqual(ellipsis("abcdef", 4), "abc…");
    assert.strictEqual(ellipsis("abc", 4), "abc");
    assert.strictEqual(stringify("text"), "text");
    assert.strictEqual(stringify({ answer: 1 }), '{"answer":1}');
    assert.strictEqual(stringify(12), "12");
  });
});
