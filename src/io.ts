import readline from "node:readline";
import type OpenAI from "openai";
import pc from "picocolors";
import { getThinking } from "./thinking.ts";
import { Abortables, ellipsis, stringify } from "./utils.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.emitKeypressEvents(process.stdin, rl);

export const finish = () => {
  Abortables.abort();
  rl.close();
};

process.stdin.on("keypress", (_str, key) => {
  if (key.ctrl && key.name === "c") {
    if (Abortables.size) Abortables.abort();
    else finish();
  }
  if (key.name === "escape") {
    Abortables.abort();
  }
});

const read = async (rl: readline.Interface): Promise<string> => {
  const cleaners: (() => void)[] = [];
  const lines: string[] = [];
  let lastChunk = "";
  let resolve: (value: string) => void;
  let done = false;
  const end = () => {
    if (!done) done = true;
    cleaners.forEach((clean) => {
      clean();
    });
    resolve(lines.join("\n"));
  };

  const onData = (chunk0: Buffer<ArrayBuffer>) => {
    const text = Buffer.from(chunk0).toString();
    lastChunk = text;
    if (text.endsWith("\r")) done = true;
  };
  process.stdin.on("data", onData);
  cleaners.push(() => process.stdin.off("data", onData));

  (async () => {
    while (!done) {
      const line = String(await new Promise((r) => rl.question("", r)));
      lines.push(
        ...(line.length >= lastChunk.length
          ? [line]
          : // pasted content is captured here
            lastChunk.split("\r").slice(0, -1)),
      );
    }
    end();
  })();

  return new Promise((r) => {
    resolve = r;
  });
};

export const input = async () => {
  const line = await read(rl);

  if (line.trim() === '"""') {
    const lines: string[] = [];
    while (true) {
      const nextLine = await read(rl);
      if (nextLine.trim() === '"""') break;
      lines.push(nextLine);
    }

    return lines.join("\n");
  }

  return line;
};

export const printMessage = (
  label: "user" | "bot" | "thinking" | "tool",
  content?: string,
) => {
  const color = (() => {
    switch (label) {
      case "user":
        return pc.green;
      case "bot":
        return pc.blue;
      case "thinking":
        return pc.magenta;
      case "tool":
        return pc.yellow;
    }
  })();
  console.log(color(`\n--- ${label} ---`));
  if (content === undefined) return;
  console.log(["thinking", "tool"].includes(label) ? pc.dim(content) : content);
};

type ToolCall = OpenAI.ChatCompletionMessageToolCall;
type FunctionToolCall = OpenAI.ChatCompletionMessageFunctionToolCall;

export const printMessages = (
  messages: OpenAI.ChatCompletionMessageParam[],
) => {
  const toolCalls: FunctionToolCall[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      printMessage("user", String(message.content));
      continue;
    }

    if (message.role === "assistant") {
      const reasoning = getThinking(message);

      if (reasoning) printMessage("thinking", reasoning);

      if (message.content) printMessage("bot", String(message.content));

      if (message.tool_calls)
        toolCalls.push(
          ...message.tool_calls.filter(
            (t: ToolCall): t is FunctionToolCall => t.type === "function",
          ),
        );
      continue;
    }

    if (message.role === "tool") {
      const toolCall = toolCalls.find(({ id }) => id === message.tool_call_id);
      if (!toolCall) continue;
      const { name, arguments: args } = toolCall.function ?? {};
      const content = message.content;
      const text = [
        ellipsis(`> ${name}(${stringify(args)})`, 300),
        ellipsis(`${stringify(content)}`, 300, 5),
      ].join("\n");
      printMessage("tool", text);
    }
  }
};
