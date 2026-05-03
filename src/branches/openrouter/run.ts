import type {
  ChatMessages,
  ChatToolCall,
  Reasoning,
} from "@openrouter/sdk/models";
import type { OpenRouter } from "@openrouter/sdk";

import { abortables, ellipsis, projectRoot, question } from "../../utils.ts";
import { executeToolCall, toolsToOpenRouterFormat } from "../../tools/index.ts";
import fs from "node:fs";
import ora from "ora";
import pc from "picocolors";

type RunType = (_args: {
  client: OpenRouter;
  userPrompt?: string;
  interceptUserPrompt?: (_prompt: string) => boolean;
  modelId: string;
  messages: ChatMessages[];
  reasoningEffort?: Reasoning;
}) => Promise<string | undefined>;

export const run: RunType = async ({
  client,
  userPrompt,
  interceptUserPrompt,
  modelId,
  messages,
  reasoningEffort,
}) => {
  console.log(pc.green("\n--- user ---"));

  if (userPrompt) {
    console.log(userPrompt);
    messages.push({ role: "user", content: userPrompt });
  } else {
    const prompt = await question();
    if (interceptUserPrompt?.(prompt)) return prompt;
    messages.push({ role: "user", content: prompt.trim() });
  }

  while (true) {
    const spinner = ora().start();

    waitForRequestSlot();
    const stream = await client.chat.send({
      chatRequest: {
        stream: true,
        messages,
        model: modelId,
        tools: toolsToOpenRouterFormat(),
        reasoning: reasoningEffort,
      },
    });

    const abortable = { abort: () => stream.cancel() };
    abortables.add(abortable);

    let content = "";
    let thinking = "";
    const tool_calls: ChatToolCall[] = [];

    let mode = "";
    for await (const event of stream) {
      const message = event.choices[0].delta;
      if (spinner.isSpinning) spinner.stop();
      if (message?.content) content += message.content;
      if (message?.reasoning) thinking += message.reasoning;
      for (const toolCall of message.toolCalls ?? []) {
        if (!tool_calls[toolCall.index]) {
          tool_calls[toolCall.index] = {
            type: "function",
            id: String(toolCall.id),
            function: {
              name: String(toolCall.function?.name),
              arguments: String(toolCall.function?.arguments),
            },
          };
        } else {
          tool_calls[toolCall.index].function.arguments += String(
            toolCall.function?.arguments,
          );
        }
      }
      if (!event.choices[0].finishReason) {
        if (message.reasoning) {
          if (mode !== "thinking") {
            if (mode) console.log("");
            console.log(pc.magenta("\n--- thinking ---"));
            mode = "thinking";
          }
          process.stdout.write(pc.dim(message.reasoning));
        }
        if (message.content) {
          if (mode !== "content") {
            if (mode) console.log("");
            console.log(pc.blue("\n--- bot ---"));
            mode = "content";
          }
          process.stdout.write(message.content);
        }
      } else {
        if (mode) {
          console.log("");
          mode = "";
        }
      }
    }

    abortables.delete(abortable);

    messages.push({
      role: "assistant",
      content,
      toolCalls: tool_calls.length ? tool_calls : undefined,
      ...(thinking ? { reasoning: thinking } : {}),
    });

    if (!tool_calls.length) break;

    for (const tool_call of tool_calls) {
      const tool_name = tool_call.function.name;
      const args = tool_call.function.arguments;
      const { result } = await executeToolCall(tool_name, args);
      const content = result.success
        ? typeof result.data === "string"
          ? result.data
          : JSON.stringify(result.data)
        : JSON.stringify(result);
      messages.push({ role: "tool", toolCallId: tool_call.id, content });

      console.log(pc.yellow("\n--- tool ---"));
      console.log(
        pc.dim(ellipsis(`> ${tool_name}(${JSON.stringify(args)})`, 300)),
      );
      console.log(pc.dim(ellipsis(`= ${content}`, 300)));
    }
  }

  // uncomment this to remove thinking and tools from history
  // messages.splice(
  //   0,
  //   messages.length,
  //   ...messages.filter((msg) => {
  //     if (msg.thinking) delete msg.thinking;
  //     if (msg.tool_calls) delete msg.tool_calls;
  //     if (!msg.content) return false;
  //     if (msg.role === "tool") return false;
  //     return true;
  //   }),
  // );
};

const waitForRequestSlot = (() => {
  const requestsHistoryFile = projectRoot + "/.request-history.tmp";
  const limit = 4;
  const WINDOW_MS = 12_000;
  /** @returns {Array<number>} */
  const getRequestHistory = () => {
    try {
      return JSON.parse(
        fs.readFileSync(requestsHistoryFile, { encoding: "utf-8" }),
      );
    } catch (_) {
      return [];
    }
  };
  const setRequestHistory = (arr) => {
    fs.promises.writeFile(requestsHistoryFile, JSON.stringify(arr));
  };
  return async () => {
    if (!Number.isFinite(limit) || limit < 1) return;

    const requestsHistory = getRequestHistory();

    const trimHistory = (now) => {
      while (
        requestsHistory.length > 0 &&
        now - requestsHistory[0] >= WINDOW_MS
      ) {
        requestsHistory.shift();
      }
    };

    while (true) {
      const now = Date.now();
      trimHistory(now);

      if (requestsHistory.length < limit) {
        requestsHistory.push(now);
        setRequestHistory(requestsHistory);
        return;
      }

      const waitMs = Math.max(1, WINDOW_MS - (now - requestsHistory[0]));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  };
})();
