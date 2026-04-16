// @ts-check

import { z } from "zod";

const apply_patch = {
  name: "apply_patch",
  description:
    'Edit text files. `apply_patch` allows you to execute a diff/patch against a text file, but the format of the diff specification is unique to this task, so pay careful attention to these instructions. To use the `apply_patch` command, you should pass a message of the following structure as "input":\n\n*** Begin Patch\n[YOUR_PATCH]\n*** End Patch\n\nWhere [YOUR_PATCH] is the actual content of your patch, specified in the following V4A diff format.\n\n*** [ACTION] File: [/absolute/path/to/file] -> ACTION can be one of Add, Update, or Delete.\nAn example of a message that you might pass as "input" to this function, in order to apply a patch, is shown below.\n\n*** Begin Patch\n*** Update File: /Users/someone/pygorithm/searching/binary_search.py\n@@class BaseClass\n@@    def search():\n-        pass\n+        raise NotImplementedError()\n\n@@class Subclass\n@@    def search():\n-        pass\n+        raise NotImplementedError()\n\n*** End Patch\nDo not use line numbers in this diff format.',
  schema: z.object({
    properties: z.string().describe("The edit patch to apply."),
    description: z
      .string()
      .describe(
        "A short description of what the tool call is aiming to achieve.",
      ),
  }),
  execute: () => {},
};

const create_directory = {
  name: "create_directory",
  description:
    "Create a new directory structure in the workspace. Will recursively create all directories in the path, like mkdir -p. You do not need to use this tool before using create_file, that tool will automatically create the needed directories.",
  schema: z.object({
    dirPath: z
      .string()
      .describe("The relative path to the directory to create."),
  }),
  execute: () => {},
};

const create_file = {
  name: "create_file",
  description:
    "This is a tool for creating a new file in the workspace. The file will be created with the specified content. The directory will be created if it does not already exist. Never use this tool to edit a file that already exists.",
  schema: z.object({
    filePath: z.string().describe("The absolute path to the file to create."),
    content: z.string().describe("The content to write to the file."),
  }),
  execute: () => {},
};

const fetch_webpage = {
  name: "fetch_webpage",
  description:
    "Fetches the main content from a web page. This tool is useful for summarizing or analyzing the content of a webpage. You should use this tool when you think the user is looking for information from a specific webpage.",
  schema: z.object({
    urls: z
      .array(z.string())
      .describe("An array of URLs to fetch content from."),
    query: z
      .string()
      .describe(
        "The query to search for in the web page's content. This should be a clear and concise description of the content you want to find.",
      ),
  }),
  execute: () => {},
};

const file_search = {
  name: "file_search",
  description:
    "Search for files in the workspace by glob pattern. This only returns the paths of matching files. Use this tool when you know the exact filename pattern of the files you're searching for. Glob patterns match from the root of the workspace folder. Examples:\n- **/*.{js,ts} to match all js/ts files in the workspace.\n- src/** to match all files under the top-level src folder.\n- **/foo/**/*.js to match all js files under any foo folder in the workspace.\n\nIn a multi-root workspace, you can scope the search to a specific workspace folder by using the absolute path to the folder as the query, e.g. /path/to/folder/**/*.ts.",
  schema: z.object({
    query: z
      .string()
      .describe(
        "Search for files with names or paths matching this glob pattern. Can also be an absolute path to a workspace folder to scope the search in a multi-root workspace.",
      ),
    maxResults: z
      .number()
      .optional()
      .describe(
        "The maximum number of results to return. Do not use this unless necessary, it can slow things down. By default, only some matches are returned. If you use this and don't see what you're looking for, you can try again with a more specific query or a larger maxResults.",
      ),
  }),
  execute: () => {},
};

const grep_search = {
  name: "grep_search",
  description:
    "Do a fast text search in the workspace. Use this tool when you want to search with an exact string or regex. If you are not sure what words will appear in the workspace, prefer using regex patterns with alternation (|) or character classes to search for multiple potential words at once instead of making separate searches. For example, use 'function|method|procedure' to look for all of those words at once. Use includePattern to search within files matching a specific pattern, or in a specific file, using a relative path. Use 'includeIgnoredFiles' to include files normally ignored by .gitignore, other ignore files, and `files.exclude` and `search.exclude` settings. Warning: using this may cause the search to be slower, only set it when you want to search in ignored folders like node_modules or build outputs. Use this tool when you want to see an overview of a particular file, instead of using read_file many times to look for code within a file.\n\nIn a multi-root workspace, you can scope the search to a specific workspace folder by using the absolute path to the folder as the includePattern, e.g. /path/to/folder.",
  schema: z.object({
    query: z.string(
      "The pattern to search for in files in the workspace. Use regex with alternation (e.g., 'word1|word2|word3') or character classes to find multiple potential words in a single search. Be sure to set the isRegexp property properly to declare whether it's a regex or plain text pattern. Is case-insensitive.",
    ),
    isRegexp: z.boolean().describe("Whether the pattern is a regex."),
    includePattern: z
      .string()
      .optional()
      .describe(
        'Search files matching this glob pattern. Will be applied to the relative path of files within the workspace. To search recursively inside a folder, use a proper glob pattern like "src/folder/**". Do not use | in includePattern. Can also be an absolute path to a workspace folder to scope the search in a multi-root workspace.',
      ),
    maxResults: z
      .number()
      .optional()
      .describe(
        "The maximum number of results to return. Do not use this unless necessary, it can slow things down. By default, only some matches are returned. If you use this and don't see what you're looking for, you can try again with a more specific query or a larger maxResults.",
      ),
    includeIgnoredFiles: z
      .boolean()
      .optional()
      .describe(
        "Whether to include files that would normally be ignored according to .gitignore, other ignore files and `files.exclude` and `search.exclude` settings. Warning: using this may cause the search to be slower. Only set it when you want to search in ignored folders like node_modules or build outputs.",
      ),
  }),
  execute: () => {},
};

const get_changed_files = {
  name: "get_changed_files",
  description:
    "Get git diffs of current file changes in a git repository. Don't forget that you can use run_in_terminal to run git commands in a terminal as well.",
  schema: z.object({
    repositoryPath: z
      .string()
      .optional()
      .describe(
        "The absolute path to the git repository to look for changes in. If not provided, the active git repository will be used.",
      ),
    sourceControlState: z
      .array(z.enum(["staged", "unstaged", "merge-conflicts"]))
      .optional()
      .describe(
        "The kinds of git state to filter by. Allowed values are: 'staged', 'unstaged', and 'merge-conflicts'. If not provided, all states will be included.",
      ),
  }),
  execute: () => {},
};

const list_dir = {
  name: "list_dir",
  description:
    "List the contents of a directory. Result will have the name of the child. If the name ends in /, it's a folder, otherwise a file",
  schema: z.object({
    path: z.string().describe("The absolute path to the directory to list."),
  }),
  execute: () => {},
};

const read_file = {
  name: "read_file",
  description:
    "Read the contents of a file.\n\nYou must specify the line range you're interested in. Line numbers are 1-indexed. If the file contents returned are insufficient for your task, you may call this tool again to retrieve more content. Prefer reading larger ranges over doing many small reads. Binary files use startLine/endLine as byte offsets.",
  schema: z.object({
    filePath: z.string().describe("The absolute path of the file to read."),
    startLine: z
      .number()
      .describe("The line number to start reading from, 1-based."),
    endLine: z
      .number()
      .describe("The inclusive line number to end reading at, 1-based."),
  }),
  execute: () => {},
};

const run_in_terminal = {
  name: "run_in_terminal",
  description:
    "This tool allows you to execute shell commands in a persistent zsh terminal session, preserving environment variables, working directory, and other context across multiple commands.\n\nCommand Execution:\n- Use && to chain simple commands on one line\n- Prefer pipelines | over temporary files for data flow\n- Never create a sub-shell (eg. bash -c \"command\") unless explicitly asked\n\nDirectory Management:\n- Prefer relative paths when navigating directories, only use absolute when the path is far away or the current cwd is not expected\n- By default (mode=sync), shell and cwd are reused by subsequent sync commands\n- Use $PWD for current directory references\n- Consider using pushd/popd for directory stack management\n- Supports directory shortcuts like ~ and -\n\nProgram Execution:\n- Supports Python, Node.js, and other executables\n- Install packages via package managers (brew, apt, etc.)\n- Use which or command -v to verify command availability\n\nAsync Mode:\n- For long-running tasks (e.g., servers), use mode=async\n- Returns a terminal ID for checking status and runtime later\n\nUse send_to_terminal to send commands or input to a terminal session.\n\nOutput Management:\n- Output is automatically truncated if longer than 60KB to prevent context overflow\n- Use head, tail, grep, awk to filter and limit output size\n- For pager commands, disable paging: git --no-pager or add | cat\n- Use wc -l to count lines before displaying large outputs\n\nBest Practices:\n- Quote variables: \"$var\" instead of $var to handle spaces\n- Use find with -exec or xargs for file operations\n- Be specific with commands to avoid excessive output\n- Avoid printing credentials unless absolutely required\n- NEVER run sleep or similar wait commands in a terminal. You will be automatically notified on your next turn when async terminal commands or timed-out sync commands complete or need input. Use get_terminal_output to check output before then\n\nInteractive Input Handling:\n- When a terminal command is waiting for interactive input, do NOT suggest alternatives or ask the user whether to proceed. Instead, use the vscode_askQuestions tool to collect the needed values from the user, then send them.\n- Send exactly one answer per prompt using send_to_terminal. Never send multiple answers in a single send.\n- After each send, call get_terminal_output to read the next prompt before sending the next answer.\n- Continue one prompt at a time until the command finishes.\n- Use type to check command type (builtin, function, alias)\n- Use jobs, fg, bg for job control\n- Use [[ ]] for conditional tests instead of [ ]\n- Prefer $() over backticks for command substitution\n- Use setopt errexit for strict error handling\n- Take advantage of zsh globbing features (**, extended globs)\n\nExecution mode:\n- mode='sync': wait for completion up to timeout; if still running, return with a terminal ID.\n- mode='async': wait for an initial idle/output signal, then return with terminal output snapshot and ID. Timeout caps how long to wait for the initial idle/output signal.\n- Prefer mode='sync' for commands that will prompt for interactive input (e.g., npm init, interactive installers, configuration wizards).\n\nTerminal notifications: When an async command finishes or a sync command times out, you will be automatically notified on your next turn with the exit code and terminal output. You will also be notified if the terminal needs input. Use get_terminal_output to check output before then. Do NOT poll or sleep to wait for completion.",
  schema: z.object({
    command: z.string().describe("The command to run in the terminal."),
    explanation: z
      .string()
      .describe(
        "A one-sentence description of what the command does. This will be shown to the user before the command is run.",
      ),
    goal: z
      .string()
      .describe(
        'A short description of the goal or purpose of the command (e.g., "Install dependencies", "Start development server").',
      ),
    mode: z.enum(["sync", "async"]).meta({
      enumDescriptions: [
        "Wait for completion up to timeout, then return with collected output. If still running at timeout, the terminal session continues in the background.",
        "Wait for an initial idle/output signal, then return with a terminal ID and output snapshot while the session may continue running.",
      ],
      description: "Execution mode for this command.",
    }),
    isBackground: z
      .boolean()
      .optional()
      .describe(
        'Legacy execution mode flag. Deprecated in favor of "mode". If true, equivalent to mode=async. If false, equivalent to mode=sync.',
      ),
    timeout: z
      .number()
      .describe(
        "Timeout in milliseconds that determines how long to wait before returning. Use 0 for no timeout.",
      ),
  }),
  execute: () => {},
};

/** @type {{name: string, description: string, schema: z.ZodObject, execute: (...a:any[])=>any}[]} */
export const ALL_TOOLS = [
  apply_patch,
  create_directory,
  create_file,
  fetch_webpage,
  file_search,
  grep_search,
  get_changed_files,
  list_dir,
  read_file,
  run_in_terminal,
];

/** @returns {import('ollama').Tool[]} */
export function toolsToOllamaFormat() {
  // @ts-ignore
  return ALL_TOOLS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema.toJSONSchema(),
    },
  }));
}

export async function executeToolCall(name, rawArgs, sandbox) {
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

  const tool = ALL_TOOLS.find((t) => t.name === name);
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

  const result = await tool.execute(parsed.data, sandbox);
  return {
    name,
    args,
    result,
  };
}

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

function ok(data) {
  return { success: true, data };
}

function fail(error) {
  return { success: false, error };
}
