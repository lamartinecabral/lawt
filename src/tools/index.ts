import fs from "node:fs";
import { projectRoot } from "../utils.ts";

import { create_file } from "./create-file.tool.ts";
import { fail } from "./utils.ts";
import { fetch_page_content } from "./web-search.tool.ts";
import { file_search } from "./file-search.tool.ts";
import { grep_search } from "./grep-search.tool.ts";
import { list_directory } from "./list-directory.tool.ts";
import { read_file } from "./read-file.tool.ts";
import { replace_string_in_file } from "./replace-string-in-file.tool.ts";
import { run_shell_command } from "./run-shell-command.tool.ts";
import { web_search } from "./web-search.tool.ts";

import type OpenAI from "openai";

/** @type {{name: string, description: string, schema: z.ZodObject, execute: (...a:any[])=>any}[]} */
const ALL_TOOLS = {
  list_directory,
  read_file,
  create_file,
  replace_string_in_file,
  file_search,
  grep_search,
  run_shell_command,
  web_search,
  fetch_page_content,
} as const;

export function toolsToOpenAIFormat() {
  return Object.values(ALL_TOOLS).map<OpenAI.ChatCompletionFunctionTool>(
    (tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema.toJSONSchema(),
      },
    }),
  );
}

async function executeToolCall<T extends keyof typeof ALL_TOOLS>(
  name: T,
  rawArgs: (typeof ALL_TOOLS)[T]["execute"] extends (_args: infer A) => any
    ? A
    : unknown,
) {
  let args = {};

  try {
    args = parseToolArgs(rawArgs);
  } catch (err) {
    return {
      name,
      args,
      result: fail(err instanceof Error ? err.message : String(err)),
    };
  }

  const tool = ALL_TOOLS[name];
  if (!tool) {
    return {
      name,
      args,
      result: fail(`Unknown tool: ${name}`),
    };
  }

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    return {
      name,
      args,
      result: fail(`Validation error: ${parsed.error.message}`),
    };
  }

  const result = await tool.execute(parsed.data as any);
  return {
    name,
    args,
    result,
  };
}

const executeToolCallWithLogging: typeof executeToolCall = async (...args) => {
  const result = await executeToolCall(...args);

  const logFile = projectRoot + "/src/tools/.logs.jsonl";
  const time = new Date().toISOString();
  try {
    await fs.promises.appendFile(
      logFile,
      JSON.stringify({ time, ...result }) + "\n",
    );
  } catch (e) {
    await fs.promises.appendFile(
      logFile,
      JSON.stringify({
        time,
        error: e instanceof Error ? e.message : String(e),
      }) + "\n",
    );
  }

  return result;
};

export { executeToolCallWithLogging as executeToolCall };

function parseToolArgs(rawArgs) {
  if (typeof rawArgs === "string") {
    let parsed;
    try {
      parsed = JSON.parse(rawArgs);
    } catch (err) {
      throw new Error(
        `Invalid tool arguments JSON: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Tool arguments must be a JSON object");
    }
    return parsed;
  }

  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    throw new Error("Tool arguments must be an object");
  }

  return rawArgs;
}
