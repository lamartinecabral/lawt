import type OpenAI from "openai";
import ora from "ora";
import pc from "picocolors";
import { question } from "./io.ts";
import { executeToolCall, toolsToOpenAIFormat } from "./tools/index.ts";
import { abortables, ellipsis } from "./utils.ts";

type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
type DeltaToolCall = OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall;

type RunType = (_args: {
  client: OpenAI;
  modelId: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  reasoningEffort: string | null | undefined;
}) => Promise<string | undefined>;

export const run: RunType = async ({
  client,
  modelId,
  messages,
  reasoningEffort,
}) => {
  console.log(pc.green("\n--- user ---"));

  const prompt = (await question()).trim();

  if (["/exit", "/quit", "/export"].includes(prompt)) return prompt;

  messages.push({ role: "user", content: prompt });

  while (true) {
    const spinner = ora().start();

    const response = await client.chat.completions.create({
      model: modelId,
      messages,
      stream: true,
      tools: toolsToOpenAIFormat(),
      // @ts-expect-error setting a valid reasoning value is a responsibility of the user
      reasoning_effort: reasoningEffort,
    });

    abortables.add(response.controller);

    let content = "";
    let thinking = "";
    const toolCalls: ToolCall[] = [];

    let mode = "";
    for await (const chunk of response) {
      const { delta: message, finish_reason } = chunk.choices[0];
      if (spinner.isSpinning) spinner.stop();
      if (message?.content) content += message.content;
      const reasoning: string | undefined =
        "reasoning" in message ? String(message.reasoning) : undefined;
      if (reasoning) thinking += reasoning;
      if (message?.tool_calls?.length)
        appendToolCalls(toolCalls, message.tool_calls);
      if (!finish_reason) {
        if (reasoning) {
          if (mode !== "thinking") {
            if (mode) console.log("");
            console.log(pc.magenta("\n--- thinking ---"));
            mode = "thinking";
          }
          process.stdout.write(pc.dim(reasoning));
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
        if (mode) console.log("");
      }
    }

    abortables.delete(response.controller);

    messages.push({
      role: "assistant",
      ...(thinking ? { reasoning_content: thinking } : {}),
      content,
      tool_calls: toolCalls.length ? toolCalls : undefined,
    });

    if (!toolCalls.length) break;

    for (const toolCall of toolCalls) {
      const tool_name = toolCall.function?.name ?? "";
      const args = toolCall.function?.arguments ?? "";
      const { result } = await executeToolCall(tool_name, args);
      const content = result.success ? result.data : `Error: ${result.error}`;
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id ?? "",
        content,
      });

      console.log(pc.yellow("\n--- tool ---"));
      console.log(
        pc.dim(ellipsis(`> ${tool_name}(${JSON.stringify(args)})`, 300)),
      );
      console.log(pc.dim(ellipsis(`= ${JSON.stringify(content)}`, 300)));
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
