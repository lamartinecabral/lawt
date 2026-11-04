import type OpenAI from "openai";
import ora from "ora";
import pc from "picocolors";
import type { GenerateResult, Thinking, ToolCall } from "./generate.ts";
import {
  appendThinking,
  extraContent,
  generate,
  getThinking,
} from "./generate.ts";
import { input, printMessage } from "./io.ts";
import type { Session } from "./session.ts";
import { executeToolCall, toolsToOpenAIFormat } from "./tools/index.ts";
import { Abortables, sleep } from "./utils.ts";

type FinishReason =
  | "done"
  | "cancelled"
  | "exit_command"
  | "export_command"
  | "export_toolcalls_command";

type RunType = (_args: {
  client: OpenAI;
  modelId: string;
  session: Session;
  reasoningEffort: string | null | undefined;
  otherSettings: Record<string, unknown>;
}) => Promise<ReturnType<typeof done>>;

export const run: RunType = async ({
  client,
  modelId,
  session,
  reasoningEffort,
  otherSettings,
}) => {
  if (isUsersTurn(session)) {
    printMessage("user");

    const prompt = (await input()).trim();

    if (["/exit", "/quit"].includes(prompt)) return done("exit_command");
    if (prompt.startsWith("/export"))
      return prompt.includes("tool")
        ? done("export_toolcalls_command")
        : done("export_command");

    session.push({ role: "user", content: prompt });
  }

  while (true) {
    const spinner = ora().start();

    const controller = {
      instance: new AbortController(),
      get signal() {
        return this.instance.signal;
      },
      aborted: false,
      abort: function () {
        this.instance.abort();
        if (spinner.isSpinning) spinner.stop();
        this.aborted = true;
      },
    };

    Abortables.add(controller);

    let stream: ReturnType<typeof generate>;
    try {
      stream = generate({
        client,
        model: modelId,
        session,
        tools: await toolsToOpenAIFormat(),
        reasoningEffort,
        otherSettings,
        stream: true,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.aborted) {
        Abortables.delete(controller);
        if (!isUsersTurn(session)) {
          session.push({ role: "assistant", content: "" });
          printMessage("bot", "");
        }
        return done("cancelled");
      } else {
        throw err;
      }
    }

    let content = "";
    const thinking: Thinking = {};
    const toolCalls: ToolCall[] = [];
    let usage: GenerateResult["usage"];

    let mode = "";
    for await (const delta of stream) {
      if (spinner.isSpinning) spinner.stop();
      const reasoning = getThinking(delta);
      appendThinking(thinking, delta);
      if (delta.content) content += delta.content;
      if (delta.tool_calls?.length) toolCalls.push(...delta.tool_calls);
      if (!delta.finish_reason) {
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
        } else {
          if (reasoning) printMessage("thinking", reasoning);
          if (delta.content) printMessage("bot", delta.content);
        }
      }
      usage = delta.usage;
    }

    Abortables.delete(controller);

    session.push({
      role: "assistant",
      ...thinking,
      content,
      tool_calls: toolCalls.length ? toolCalls : undefined,
    });

    if (!toolCalls.length) {
      if (controller.aborted) return done("cancelled");
      return done("done", usage);
    }

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

      printMessage("tool", tool_name, args, content);
      await sleep(200);
    }
  }
};

const done = (finishReason: FinishReason, usage?: GenerateResult["usage"]) => {
  return { finishReason, usage };
};

const isUsersTurn = (session: Session) => {
  if (!session.messages.length) return true;
  const lastMessage = session.messages[session.messages.length - 1];
  return lastMessage.role !== "user" && lastMessage.role !== "tool";
};
