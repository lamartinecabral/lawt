import type { Chat, FunctionCall, FunctionResponse } from "@google/genai";

import { ellipsis, projectRoot, question } from "../../utils.ts";
import { executeToolCall } from "../../tools/index.ts";
import fs from "node:fs";
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

    await waitForRequestSlot();
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
      const content = result.success ? result.data : `Error: ${result.error}`;
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

const waitForRequestSlot = (() => {
  const requestsHistoryFile = projectRoot + "/.request-history.tmp";
  const limit = 3;
  const WINDOW_MS = 12_000;
  /** @returns {Array<number>} */
  const getRequestHistory = () => {
    try {
      return JSON.parse(
        fs.readFileSync(requestsHistoryFile, { encoding: "utf-8" }),
      );
    } catch (_) {
      return [];
    }
  };
  const setRequestHistory = (arr) => {
    fs.promises.writeFile(requestsHistoryFile, JSON.stringify(arr));
  };
  return async () => {
    if (!Number.isFinite(limit) || limit < 1) return;

    const requestsHistory = getRequestHistory();

    const trimHistory = (now) => {
      while (
        requestsHistory.length > 0 &&
        now - requestsHistory[0] >= WINDOW_MS
      ) {
        requestsHistory.shift();
      }
    };

    while (true) {
      const now = Date.now();
      trimHistory(now);

      if (requestsHistory.length < limit) {
        requestsHistory.push(now);
        setRequestHistory(requestsHistory);
        return;
      }

      const waitMs = Math.max(1, WINDOW_MS - (now - requestsHistory[0]));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  };
})();
