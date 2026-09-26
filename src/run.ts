import type OpenAI from "openai";
import ora from "ora";
import pc from "picocolors";
import { printMessage, question } from "./io.ts";
import type { Session } from "./session.ts";
import type { Thinking } from "./thinking.ts";
import { appendThinking, getThinking } from "./thinking.ts";
import { executeToolCall, toolsToOpenAIFormat } from "./tools/index.ts";
import { abortables, ellipsis, stringify } from "./utils.ts";

type ToolCall = OpenAI.ChatCompletionMessageFunctionToolCall;
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

    const stream = await client.chat.completions.create({
      model: modelId,
      messages: session.messages,
      stream: true,
      tools: await toolsToOpenAIFormat(),
      // @ts-expect-error setting a valid reasoning value is a responsibility of the user
      reasoning_effort: reasoningEffort,
      stream_options: {
        include_usage: true,
      },
    });

    abortables.add(stream.controller);

    let content = "";
    const thinking: Thinking = {};
    const toolCalls: ToolCall[] = [];

    let mode = "";
    for await (const chunk of stream) {
      if (!chunk.choices.length) continue;
      const { delta, finish_reason } = chunk.choices[0];
      if (spinner.isSpinning) spinner.stop();
      if (delta?.content) content += delta.content;
      const reasoning = getThinking(delta);
      appendThinking(thinking, delta);
      if (delta?.tool_calls?.length)
        appendToolCalls(toolCalls, delta.tool_calls);
      if (!finish_reason) {
        if (reasoning) {
          if (mode !== "thinking") {
            if (mode) console.log("");
            printMessage("thinking");
            mode = "thinking";
            process.stdout.write(pc.dim(reasoning.trimStart()));
          } else {
            process.stdout.write(pc.dim(reasoning));
          }
        }
        if (delta.content) {
          if (mode !== "content") {
            if (mode) console.log("");
            printMessage("bot");
            mode = "content";
          }
          process.stdout.write(delta.content);
        }
      } else {
        if (mode) {
          mode = "";
          console.log("");
        }
      }
    }

    abortables.delete(stream.controller);

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
        ...extraContent(toolCall),
      });

      printMessage(
        "tool",
        [
          ellipsis(`> ${tool_name}(${stringify(args)})`, 300),
          ellipsis(`${stringify(content)}`, 300, 5),
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
        ...extraContent(delta),
      });
    else {
      const lastCall = toolCalls[toolCalls.length - 1].function;
      if (!lastCall) continue;
      if (!lastCall.arguments) lastCall.arguments = "";
      lastCall.arguments += delta.function?.arguments ?? "";
    }
  }
};

// this is a necessary to support gemini api
const extraContent = (obj: unknown) => {
  return typeof obj === "object" && obj && "extra_content" in obj
    ? { extra_content: obj.extra_content }
    : {};
};
