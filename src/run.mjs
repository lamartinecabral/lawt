// @ts-check
import { abortables, ellipsis, ollama, question } from "./utils.mjs";
import ora from "ora";
import pc from "picocolors";
import { toolRegistry } from "./tools.mjs";

/**
 * @param {object} param0
 * @param {string} [param0.userPrompt]
 * @param {(prompt: string) => boolean} [param0.interceptPrompt]
 * @param {string} param0.modelId
 * @param {import("ollama").Message[]} param0.messages
 * @param {number} param0.contextLength
 * @param {import("ollama").ChatRequest['think']} [param0.reasoningEffort]
 * @returns {Promise<string | undefined>}
 */
export const run = async ({
  userPrompt,
  interceptPrompt,
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
    if (interceptPrompt?.(prompt)) return prompt;
    messages.push({ role: "user", content: prompt });
  }
  // userPrompt = "increment the value in counter.txt";

  while (true) {
    const spinner = ora().start();

    const response = await ollama.chat({
      stream: true,
      options: { num_ctx: +contextLength },
      model: modelId,
      messages,
      tools: Object.values(toolRegistry).map((a) => a.definition),
      think: reasoningEffort,
    });

    abortables.add(response);

    let content = "";
    let tool_calls = [];

    let mode = "";
    for await (const res of response) {
      const { message, done } = res;
      if (spinner.isSpinning) spinner.stop();
      if (message?.content) content += message.content;
      if (message?.tool_calls?.length) tool_calls.push(...message.tool_calls);
      if (!done) {
        const chunk = Object.fromEntries(
          [
            ["content", message.content],
            ["thinking", message.thinking],
          ].filter((a) => a[1]),
        );
        if ("thinking" in chunk) {
          if (mode !== "thinking") {
            if (mode) console.log("");
            console.log(pc.magenta("\n--- thinking ---"));
            mode = "thinking";
          }
          process.stdout.write(pc.dim(chunk.thinking));
        }
        if ("content" in chunk) {
          if (mode !== "content") {
            if (mode) console.log("");
            console.log(pc.blue("\n--- bot ---"));
            mode = "content";
          }
          process.stdout.write(chunk.content);
        }
      }
    }
    if (mode) console.log("");

    abortables.delete(response);

    messages.push({
      role: "assistant",
      content,
      tool_calls: tool_calls.length ? tool_calls : undefined,
    });

    if (!tool_calls.length) break;

    for (const tool_call of tool_calls) {
      const tool_name = tool_call.function.name;
      const args = tool_call.function.arguments;
      const content = await toolRegistry[tool_name].execute(args);
      messages.push({ role: "tool", tool_name, content });

      console.log(pc.yellow("\n--- tool ---"));
      console.log(
        pc.dim(ellipsis(`> ${tool_name}(${JSON.stringify(args)})`, 300)),
      );
      console.log(pc.dim(ellipsis(`= ${content}`, 300)));
    }
  }
};
