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
