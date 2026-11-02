import type OpenAI from "openai";
import type { Session } from "./session.ts";
import { isRecord } from "./utils.ts";

type GenerateParams = {
  client: OpenAI;
  model: string;
  session: Session;
  tools: OpenAI.ChatCompletionFunctionTool[];
  reasoningEffort: string | null | undefined;
  otherSettings: Record<string, unknown>;
  stream: boolean;
  signal: AbortSignal;
};

export type GenerateResult = Partial<
  { content: string } & Thinking & { tool_calls: ToolCall[] } & {
      finish_reason: string;
    } & {
      usage?: OpenAI.Completions.CompletionUsage | null;
    }
>;

export async function* generate({
  client,
  model,
  session,
  tools,
  reasoningEffort,
  otherSettings,
  stream,
  signal,
}: GenerateParams): AsyncGenerator<GenerateResult> {
  const params: OpenAI.ChatCompletionCreateParams = {
    ...otherSettings,
    model,
    messages: session.messages,
    tools,
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
      if (chunk.usage) yield { usage: chunk.usage };
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
        yield { finish_reason };
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

export type ToolCall = OpenAI.ChatCompletionMessageFunctionToolCall;
type DeltaToolCall = OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall;

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

export type Thinking = {
  reasoning?: string;
  reasoning_content?: string;
};

export const appendThinking = (obj: Thinking, delta: object) => {
  if ("reasoning" in delta && typeof delta.reasoning === "string") {
    if (!obj.reasoning) obj.reasoning = "";
    obj.reasoning += delta.reasoning;
    return;
  }
  if (
    "reasoning_content" in delta &&
    typeof delta.reasoning_content === "string"
  ) {
    if (!obj.reasoning_content) obj.reasoning_content = "";
    obj.reasoning_content += delta.reasoning_content;
    return;
  }
};

export const getThinking = (message: unknown) => {
  if (!isRecord(message)) return undefined;
  if ("reasoning" in message && typeof message.reasoning === "string") {
    return message.reasoning;
  }
  if (
    "reasoning_content" in message &&
    typeof message.reasoning_content === "string"
  ) {
    return message.reasoning_content;
  }
  return undefined;
};

// this is a necessary to support gemini api
export const extraContent = (obj: unknown) => {
  return typeof obj === "object" && obj && "extra_content" in obj
    ? { extra_content: obj.extra_content }
    : {};
};
