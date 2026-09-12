import type OpenAI from "openai";
import { create_file } from "./create-file.tool.ts";
import { file_search } from "./file-search.tool.ts";
import { grep_search } from "./grep-search.tool.ts";
import { list_directory } from "./list-directory.tool.ts";
import { read_file } from "./read-file.tool.ts";
import { replace_string_in_file } from "./replace-string-in-file.tool.ts";
import { run_shell_command } from "./run-shell-command.tool.ts";
import { fail } from "./utils.ts";
import { fetch_page_content, web_search } from "./web-search.tool.ts";

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

export async function executeToolCall(name: string, rawArgs: unknown) {
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

  const result = await tool.execute(parsed.data);
  return {
    name,
    args,
    result,
  };
}

function parseToolArgs(rawArgs) {
  if (typeof rawArgs === "string") {
    let parsed: unknown;
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
