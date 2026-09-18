import type OpenAI from "openai";
import ora from "ora";
import pc from "picocolors";
import { printMessage, question } from "./io.ts";
import type { Session } from "./session.ts";
import type { Thinking } from "./thinking.ts";
import { appendThinking, getThinking } from "./thinking.ts";
import { executeToolCall, toolsToOpenAIFormat } from "./tools/index.ts";
import { abortables, ellipsis, stringify } from "./utils.ts";

type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
type DeltaToolCall = OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall;

type RunType = (_args: {
  client: OpenAI;
  modelId: string;
  session: Session;
  reasoningEffort: string | null | undefined;
}) => Promise<string | undefined>;

export const run: RunType = async ({
  client,
  modelId,
  session,
  reasoningEffort,
}) => {
  printMessage("user");

  const prompt = (await question()).trim();

  if (["/exit", "/quit", "/export", "/model"].includes(prompt)) return prompt;

  session.push({ role: "user", content: prompt });

  while (true) {
    const spinner = ora().start();

    const response = await client.chat.completions.create({
      model: modelId,
      messages: session.messages,
      stream: true,
      tools: await toolsToOpenAIFormat(),
      // @ts-expect-error setting a valid reasoning value is a responsibility of the user
      reasoning_effort: reasoningEffort,
    });

    abortables.add(response.controller);

    let content = "";
    const thinking: Thinking = {};
    const toolCalls: ToolCall[] = [];

    let mode = "";
    for await (const chunk of response) {
      if (!chunk.choices.length) continue;
      const { delta: message, finish_reason } = chunk.choices[0];
      if (spinner.isSpinning) spinner.stop();
      if (message?.content) content += message.content;
      const reasoning = getThinking(message);
      appendThinking(thinking, message);
      if (message?.tool_calls?.length)
        appendToolCalls(toolCalls, message.tool_calls);
      if (!finish_reason) {
        if (reasoning) {
          if (mode !== "thinking") {
            if (mode) console.log("");
            printMessage("thinking");
            mode = "thinking";
          }
          process.stdout.write(pc.dim(reasoning));
        }
        if (message.content) {
          if (mode !== "content") {
            if (mode) console.log("");
            printMessage("bot");
            mode = "content";
          }
          process.stdout.write(message.content);
        }
      } else {
        if (mode) {
          mode = "";
          console.log("");
        }
      }
    }

    abortables.delete(response.controller);

    session.push({
      role: "assistant",
      ...thinking,
      content,
      tool_calls: toolCalls.length ? toolCalls : undefined,
    });

    if (!toolCalls.length) break;

    for (const toolCall of toolCalls) {
      const tool_name = toolCall.function?.name ?? "";
      const args = toolCall.function?.arguments ?? "";
      const { result } = await executeToolCall(tool_name, args);
      const content = result.success ? result.data : `Error: ${result.error}`;
      session.push({
        role: "tool",
        tool_call_id: toolCall.id ?? "",
        content,
      });

      printMessage(
        "tool",
        [
          ellipsis(`> ${tool_name}(${stringify(args)})`, 300),
          ellipsis(`= ${stringify(content)}`, 300),
        ].join("\n"),
      );
    }
  }
};

const appendToolCalls = (
  toolCalls: ToolCall[],
  deltas: DeltaToolCall[],
): void => {
  for (const delta of deltas) {
    if (delta.function?.name)
      toolCalls.push({
        id: delta.id ?? "",
        type: "function",
        function: {
          name: delta.function.name,
          arguments: delta.function.arguments ?? "",
        },
      });
    else {
      const lastCall = toolCalls[toolCalls.length - 1].function;
      if (!lastCall) continue;
      if (!lastCall.arguments) lastCall.arguments = "";
      lastCall.arguments += delta.function?.arguments ?? "";
    }
  }
};
