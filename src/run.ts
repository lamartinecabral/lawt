import type OpenAI from "openai";
import ora from "ora";
import pc from "picocolors";
import { input, printMessage } from "./io.ts";
import type { Session } from "./session.ts";
import type { Thinking } from "./thinking.ts";
import { appendThinking, getThinking } from "./thinking.ts";
import { executeToolCall, toolsToOpenAIFormat } from "./tools/index.ts";
import { Abortables } from "./utils.ts";

type ToolCall = OpenAI.ChatCompletionMessageFunctionToolCall;
type DeltaToolCall = OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall;

type FinishReason =
  | "done"
  | "cancelled"
  | "exit_command"
  | "export_command"
  | "list_command"
  | "toggle_stream";

type RunType = (_args: {
  client: OpenAI;
  modelId: string;
  session: Session;
  reasoningEffort: string | null | undefined;
  otherSettings: Record<string, unknown>;
  stream: boolean;
}) => Promise<ReturnType<typeof done>>;

export const run: RunType = async ({
  client,
  modelId,
  session,
  reasoningEffort,
  otherSettings,
  stream: streamFlag,
}) => {
  if (isUsersTurn(session)) {
    printMessage("user");

    const prompt = (await input()).trim();

    if (["/exit", "/quit"].includes(prompt)) return done("exit_command");
    if (["/export"].includes(prompt)) return done("export_command");
    if (["/model"].includes(prompt)) return done("list_command");
    if (["/stream"].includes(prompt)) return done("toggle_stream");

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
        reasoningEffort,
        otherSettings,
        stream: streamFlag,
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
    }
  }
};

const done = (finishReason: FinishReason, usage?: GenerateResult["usage"]) => {
  return { finishReason, usage };
};

type GenerateParams = {
  client: OpenAI;
  model: string;
  session: Session;
  reasoningEffort: string | null | undefined;
  otherSettings: Record<string, unknown>;
  stream: boolean;
  signal: AbortSignal;
};

type GenerateResult = Partial<
  { content: string } & Thinking & { tool_calls: ToolCall[] } & {
      finish_reason: string;
      usage?: OpenAI.Completions.CompletionUsage | null;
    }
>;

async function* generate({
  client,
  model,
  session,
  reasoningEffort,
  otherSettings,
  stream,
  signal,
}: GenerateParams): AsyncGenerator<GenerateResult> {
  const params: OpenAI.ChatCompletionCreateParams = {
    ...otherSettings,
    model,
    messages: session.messages,
    tools: await toolsToOpenAIFormat(),
    // @ts-expect-error setting a valid reasoning value is a responsibility of the user
    reasoning_effort: reasoningEffort,
    stream_options: {
      include_usage: true,
    },
  };
  if (stream) {
    const stream = await client.chat.completions.create(
      { ...params, stream: true },
      { signal },
    );

    const toolCalls: ToolCall[] = [];

    for await (const chunk of stream) {
      if (!chunk.choices.length) continue;
      const { delta, finish_reason } = chunk.choices[0];
      if (getThinking(delta)) {
        const thinking: Thinking = {};
        appendThinking(thinking, delta);
        yield thinking;
      }
      if (delta?.content) {
        yield { content: delta.content };
      }
      if (delta?.tool_calls?.length) {
        appendToolCalls(toolCalls, delta.tool_calls);
      }
      if (finish_reason) {
        if (toolCalls.length) {
          yield { tool_calls: toolCalls };
        }
        yield { finish_reason, usage: chunk.usage };
        return;
      }
    }
  } else {
    const response = await client.chat.completions.create(
      { ...params, stream: false },
      { signal },
    );
    if (!response.choices.length) {
      yield { finish_reason: "done", usage: response.usage };
    }
    const { message, finish_reason } = response.choices[0];
    if (getThinking(message)) {
      const thinking: Thinking = {};
      appendThinking(thinking, message);
      yield thinking;
    }
    if (message.content) {
      yield { content: message.content };
    }
    if (message.tool_calls?.length) {
      // @ts-expect-error multiple types of tools calls are not expected
      yield { tool_calls: message.tool_calls };
    }
    yield { finish_reason, usage: response.usage };
    return;
  }
}

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

const isUsersTurn = (session: Session) => {
  if (!session.messages.length) return true;
  const lastMessage = session.messages[session.messages.length - 1];
  return lastMessage.role !== "user" && lastMessage.role !== "tool";
};
