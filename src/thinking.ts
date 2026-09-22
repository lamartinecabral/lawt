import type OpenAI from "openai";
import { isRecord } from "./utils.ts";

export type Thinking = {
  reasoning?: string;
  reasoning_content?: string;
};

export const appendThinking = (
  obj: Thinking,
  delta: OpenAI.ChatCompletionChunk.Choice.Delta,
) => {
  if ("reasoning" in delta && delta.reasoning) {
    if (!obj.reasoning) obj.reasoning = "";
    obj.reasoning += String(delta.reasoning);
    return obj;
  }
  if ("reasoning_content" in delta && delta.reasoning_content) {
    if (!obj.reasoning_content) obj.reasoning_content = "";
    obj.reasoning_content += String(delta.reasoning_content);
    return obj;
  }
};

export const getThinking = (message: unknown) => {
  if (!isRecord(message)) return undefined;
  if ("reasoning" in message && message.reasoning)
    return String(message.reasoning);
  if ("reasoning_content" in message && message.reasoning_content)
    return String(message.reasoning_content);
  return undefined;
};
