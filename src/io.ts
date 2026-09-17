import readline from "node:readline";
import type OpenAI from "openai";
import pc from "picocolors";
import { getThinking } from "./thinking.ts";
import { abortables, ellipsis, stringify } from "./utils.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.emitKeypressEvents(process.stdin, rl);

export const question = async () => {
  const read = () => {
    return new Promise<string>((resolve) => rl.question("", resolve));
  };

  const line = await read();

  if (line.trim() === '"""') {
    const lines: string[] = [];
    while (true) {
      const nextLine = await read();
      if (nextLine.trim() === '"""') break;
      lines.push(nextLine);
    }

    return lines.join("\n");
  }

  return line;
};

const abort = () => {
  for (const abortable of abortables) abortable.abort();
};

export const finish = () => {
  abort();
  rl.close();
};

process.stdin.on("keypress", (_str, key) => {
  if (key.ctrl && key.name === "c") {
    finish();
  }
  if (key.name === "escape") {
    abort();
  }
});

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
        ellipsis(`= ${stringify(content)}`, 300),
      ].join("\n");
      printMessage("tool", text);
    }
  }
};
