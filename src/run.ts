import { abortables, ellipsis } from "./utils.ts";
import { executeToolCall, toolsToOpenAIFormat } from "./tools/index.ts";

import OpenAI from "openai";
import ora from "ora";
import pc from "picocolors";
import { question } from "./io.ts";

type RunType = (_args: {
  client: OpenAI;
  modelId: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  reasoningEffort: any;
}) => Promise<string | undefined>;

export const run: RunType = async ({
  client,
  modelId,
  messages,
  reasoningEffort,
}) => {
  console.log(pc.green("\n--- user ---"));

  const prompt = await question();

  if (["/exit", "/quit"].includes(prompt.trim())) return prompt;

  messages.push({ role: "user", content: prompt.trim() });

  while (true) {
    const spinner = ora().start();

    const response = await client.chat.completions.create({
      model: modelId,
      messages,
      stream: true,
      tools: toolsToOpenAIFormat(),
      reasoning_effort: reasoningEffort,
    });

    abortables.add(response.controller);

    let content = "";
    let thinking = "";
    const tool_calls: OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall[] = [];

    let mode = "";
    for await (const chunk of response) {
      const { delta: message, finish_reason } = chunk.choices[0];
      if (spinner.isSpinning) spinner.stop();
      if (message?.content) content += message.content;
      const reasoning: string | undefined = message?.["reasoning"];
      if (reasoning) thinking += reasoning;
      if (message?.tool_calls?.length) tool_calls.push(...message.tool_calls);
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
      content,
      tool_calls: tool_calls.length ? (tool_calls as any) : undefined,
      ...(thinking ? { reasoning_content: thinking } : {}),
    });

    if (!tool_calls.length) break;

    for (const tool_call of tool_calls) {
      const tool_name = tool_call.function?.name ?? "";
      const args = tool_call.function?.arguments ?? "";
      const { result } = await executeToolCall(tool_name as any, args);
      const content = result.success ? result.data : `Error: ${result.error}`;
      messages.push({
        role: "tool",
        tool_call_id: tool_call.id ?? "",
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
