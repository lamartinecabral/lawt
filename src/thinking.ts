import type OpenAI from "openai";

export type Thinking = {
  reasoning?: string;
  reasoning_content?: string;
};

export const appendThinking = (
  obj: Thinking,
  delta: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta,
) => {
  if ("reasoning" in delta) {
    if (!obj.reasoning) obj.reasoning = "";
    obj.reasoning += String(delta.reasoning);
    return obj;
  }
  if ("reasoning_content" in delta) {
    if (!obj.reasoning_content) obj.reasoning_content = "";
    obj.reasoning_content += String(delta.reasoning_content);
    return obj;
  }
};

export const getThinking = (message: unknown) => {
  if (typeof message !== "object" || !message) return undefined;
  if ("reasoning" in message) return String(message.reasoning);
  if ("reasoning_content" in message) return String(message.reasoning_content);
  return undefined;
};
