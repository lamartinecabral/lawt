import type { ChatRequest, Message, Ollama, ToolCall } from "ollama";

import { abortables, ellipsis, question } from "../../utils.ts";
import { executeToolCall, toolsToOllamaFormat } from "../../tools/index.ts";
import ora from "ora";
import pc from "picocolors";

type RunType = (_args: {
  ollama: Ollama;
  userPrompt?: string;
  interceptUserPrompt?: (_prompt: string) => boolean;
  modelId: string;
  messages: Message[];
  contextLength?: number;
  reasoningEffort: ChatRequest["think"];
}) => Promise<string | undefined>;

export const run: RunType = async ({
  ollama,
  userPrompt,
  interceptUserPrompt,
  modelId,
  messages,
  contextLength,
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

    const response = await ollama.chat({
      stream: true,
      options: { num_ctx: contextLength ?? undefined },
      model: modelId,
      messages,
      tools: toolsToOllamaFormat(),
      think: reasoningEffort,
      keep_alive: "20m",
    });

    abortables.add(response);

    let content = "";
    let thinking = "";
    const tool_calls: ToolCall[] = [];

    let mode = "";
    for await (const chunk of response) {
      const { message, done, eval_count, prompt_eval_count } = chunk;
      if (spinner.isSpinning) spinner.stop();
      if (message?.content) content += message.content;
      if (message?.thinking) thinking += message.thinking;
      if (message?.tool_calls?.length) tool_calls.push(...message.tool_calls);
      if (!done) {
        if (message.thinking) {
          if (mode !== "thinking") {
            if (mode) console.log("");
            console.log(pc.magenta("\n--- thinking ---"));
            mode = "thinking";
          }
          process.stdout.write(pc.dim(message.thinking));
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
        if (mode === "content") {
          console.log(
            pc.dim(
              `(input tokens: ${prompt_eval_count}, output tokens: ${eval_count})`,
            ),
          );
        }
      }
    }

    abortables.delete(response);

    messages.push({
      role: "assistant",
      content,
      tool_calls: tool_calls.length ? tool_calls : undefined,
      ...(thinking ? { thinking } : {}),
    });

    if (!tool_calls.length) break;

    for (const tool_call of tool_calls) {
      const tool_name = tool_call.function.name;
      const args = tool_call.function.arguments;
      const { result } = await executeToolCall(tool_name as any, args);
      const content = result.success ? result.data : `Error: ${result.error}`;
      messages.push({ role: "tool", tool_name, content });

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
