import type { Chat, FunctionCall, FunctionResponse } from "@google/genai";

import { ellipsis, question } from "../../utils.ts";
import { executeToolCall } from "../../tools/index.ts";
import ora from "ora";
import pc from "picocolors";

type RunType = (_args: {
  userPrompt?: string;
  interceptUserPrompt?: (_prompt: string) => boolean;
  chat: Chat;
}) => Promise<string | undefined>;

export const run: RunType = async ({
  userPrompt,
  interceptUserPrompt,
  chat,
}) => {
  console.log(pc.green("\n--- user ---"));

  if (userPrompt) {
    console.log(userPrompt);
  } else {
    const prompt = await question();
    if (interceptUserPrompt?.(prompt)) return prompt;
    userPrompt = prompt;
  }

  let functionResponses: FunctionResponse[] = [];
  while (true) {
    const spinner = ora().start();

    const response = await chat.sendMessageStream({
      message: functionResponses.length
        ? functionResponses.map((r) => ({ functionResponse: r }))
        : userPrompt,
    });
    functionResponses = [];

    const tool_calls: FunctionCall[] = [];

    let mode = "";
    for await (const chunk of response) {
      const part = chunk.candidates?.[0].content?.parts?.[0];
      if (!part) continue;

      const { text, thought, functionCall } = part;

      if (spinner.isSpinning) spinner.stop();
      if (functionCall) tool_calls.push(functionCall);

      if (chunk.candidates?.[0].finishReason !== "STOP") {
        if (thought) {
          if (mode !== "thinking") {
            if (mode) console.log("");
            console.log(pc.magenta("\n--- thinking ---"));
            mode = "thinking";
          }
          process.stdout.write(pc.dim(text));
        } else if (text) {
          if (mode !== "content") {
            if (mode) console.log("");
            console.log(pc.blue("\n--- bot ---"));
            mode = "content";
          }
          process.stdout.write(text);
        }
      } else {
        if (mode) console.log("");
      }
    }

    if (!tool_calls.length) break;

    for (const tool_call of tool_calls) {
      const tool_name = tool_call.name;
      const args = tool_call.args;
      const { result } = await executeToolCall(tool_name, args);
      const content = result.success
        ? typeof result.data === "string"
          ? result.data
          : JSON.stringify(result.data)
        : JSON.stringify(result);
      functionResponses.push({
        id: tool_call.id,
        name: tool_name,
        response: result.success
          ? { output: result.data }
          : { error: result.error },
      });

      console.log(pc.yellow("\n--- tool ---"));
      console.log(
        pc.dim(ellipsis(`> ${tool_name}(${JSON.stringify(args)})`, 300)),
      );
      console.log(pc.dim(ellipsis(`= ${content}`, 300)));
    }
  }
};
