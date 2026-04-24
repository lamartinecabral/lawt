// @ts-check

import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Tool } from "ollama";
import { z } from "zod";

const makeTool = <T extends z.ZodObject>(params: {
  name: string;
  description: string;
  schema: T;
  execute: (_args: z.infer<T>) => any;
}) => params;

const list_directory = makeTool({
  name: "list_directory",
  description:
    "List the contents of a directory. Result will have the name of the child. If the name ends in /, it's a folder, otherwise a file",
  schema: z.object({
    path: z.string().describe("The relative path to the directory to list."),
  }),
  async execute(args) {
    try {
      const resolvedPath = getResolvedPath(args.path);

      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return fail(`Not a directory: ${args.path}`);
      }

      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const sorted = entries
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      const list = sorted.map((entry) =>
        entry.isDirectory() ? `${entry.name}/` : entry.name,
      );

      return ok(list);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

const read_file = makeTool({
  name: "read_file",
  description:
    "Read the contents of a file.\n\nYou must specify the line range you're interested in. Line numbers are 1-indexed. If the file contents returned are insufficient for your task, you may call this tool again to retrieve more content. Prefer reading larger ranges over doing many small reads. Binary files use startLine/endLine as byte offsets.",
  schema: z.object({
    file_path: z.string().describe("The relative path of the file to read."),
    position: z
      .number()
      .describe("The line number to start reading from, 1-based."),
    line_count: z.number().describe("The number of lines to be returned."),
  }),
  async execute(args) {
    try {
      const resolvedPath = getResolvedPath(args.file_path);
      const stats = await fs.stat(resolvedPath);

      if (!stats.isFile()) {
        return fail(`Not a file: ${args.file_path}`);
      }

      const content = await fs.readFile(resolvedPath, "utf-8");
      const lines = content.split(/\r\n|\r|\n/);
      const startIndex = args.position - 1;
      const endIndex = Math.min(lines.length, startIndex + args.line_count);

      return ok(lines.slice(startIndex, endIndex).join("\n"));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

const create_file = makeTool({
  name: "create_file",
  description:
    "This is a tool for creating a new file in the workspace. The file will be created with the specified content. The directory will be created if it does not already exist. Never use this tool to edit a file that already exists.",
  schema: z.object({
    file_path: z.string().describe("The relative path to the file to create."),
    content: z.string().describe("The content to write to the file."),
  }),
  async execute(args) {
    try {
      const resolvedPath = getResolvedPath(args.file_path);

      try {
        await fs.stat(resolvedPath);
        return fail(`File already exists: ${args.file_path}`);
      } catch (err) {
        if (!(err instanceof Error && err["code"] === "ENOENT")) {
          return fail(String(err));
        }
      }

      const directory = path.dirname(resolvedPath);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(resolvedPath, args.content, "utf-8");

      return ok({ file_path: resolvedPath });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

const update_file = makeTool({
  name: "update_file",
  description:
    "Update an existing file by removing zero or more lines and inserting a new content in place.",
  schema: z.object({
    file_path: z.string().describe("The relative path of the file to update."),
    position: z
      .number()
      .optional()
      .describe(
        "The line number to insert the new content, 1-based. If omitted, the new content will be appended.",
      ),
    delete_count: z
      .number()
      .optional()
      .describe(
        "The number of lines to remove. If omitted, no lines will be removed.",
      ),
    content: z
      .string()
      .optional()
      .describe(
        "The content to write to the file. If omitted, only line removal will be applied.",
      ),
  }),
  async execute(args) {
    try {
      const resolvedPath = getResolvedPath(args.file_path);
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return fail(`Not a file: ${args.file_path}`);
      }

      const original = await fs.readFile(resolvedPath, "utf-8");
      const newline = original.includes("\r\n") ? "\r\n" : "\n";
      const lines = original.split(/\r\n|\n/);
      const deleteCount = args.delete_count ?? 0;

      if (!Number.isInteger(deleteCount) || deleteCount < 0) {
        return fail("Invalid delete_count: must be a non-negative integer.");
      }

      const position = args.position;

      if (
        position !== undefined &&
        (!Number.isInteger(position) || position < 1)
      ) {
        return fail("Invalid position: must be a positive integer.");
      }

      const insertLines =
        args.content === undefined ? [] : args.content.split(/\r\n|\n/);

      let updatedLines: string[] = [];
      if (!position) {
        updatedLines = [
          lines.slice(0, lines.length - deleteCount),
          insertLines,
        ].flat();
      } else {
        updatedLines = [
          lines.slice(0, position - 1),
          insertLines,
          lines.slice(position - 1 + deleteCount),
        ].flat();
      }

      const updated = updatedLines.join(newline);
      if (updated === original) {
        return ok({ file_path: resolvedPath, modified: false });
      }

      await fs.writeFile(resolvedPath, updated, "utf-8");
      return ok({ file_path: resolvedPath, modified: true });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

const file_search = makeTool({
  name: "file_search",
  description:
    "Search for files in the workspace by glob pattern. This only returns the paths of matching files. Use this tool when you know the exact filename pattern of the files you're searching for. Glob patterns match from the root of the workspace folder. Examples:\n- **/*.{js,ts} to match all js/ts files in the workspace.\n- src/** to match all files under the top-level src folder.\n- **/foo/**/*.js to match all js files under any foo folder in the workspace.\n\nIn a multi-root workspace, you can scope the search to a specific workspace folder by using the absolute path to the folder as the query, e.g. /path/to/folder/**/*.ts.",
  schema: z.object({
    query: z
      .string()
      .describe(
        "Search for files with names or paths matching this glob pattern. Can also be an absolute path to a workspace folder to scope the search in a multi-root workspace.",
      ),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return fail("Query must be a non-empty string.");
      }

      const normalizedPattern = normalizeSearchPattern(query);
      const matches = await fg(normalizedPattern, {
        cwd: process.cwd(),
        onlyFiles: true,
        dot: true,
        unique: true,
      });

      return ok(matches.sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

const grep_search = makeTool({
  name: "grep_search",
  description:
    "Do a fast text search in the workspace. Use this tool when you want to search with an exact string or regex. If you are not sure what words will appear in the workspace, prefer using regex patterns with alternation (|) or character classes to search for multiple potential words at once instead of making separate searches. For example, use 'function|method|procedure' to look for all of those words at once. Use includePattern to search within files matching a specific pattern, or in a specific file, using a relative path.",
  schema: z.object({
    query: z.string(
      "The pattern to search for in files in the workspace. Use regex with alternation (e.g., 'word1|word2|word3') or character classes to find multiple potential words in a single search. Be sure to set the isRegexp property properly to declare whether it's a regex or plain text pattern. Is case-insensitive.",
    ),
    isRegexp: z.boolean().describe("Whether the pattern is a regex."),
    includePattern: z
      .string()
      .optional()
      .describe(
        'Search files matching this glob pattern. Will be applied to the relative path of files within the workspace. To search recursively inside a folder, use a proper glob pattern like "src/folder/**". Do not use | in includePattern.',
      ),
    maxResults: z
      .number()
      .optional()
      .describe(
        "The maximum number of results to return. Do not use this unless necessary, it can slow things down. By default, only some matches are returned. If you use this and don't see what you're looking for, you can try again with a more specific query or a larger maxResults.",
      ),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return fail("Query must be a non-empty string.");
      }

      const maxResults = args.maxResults;
      if (
        maxResults !== undefined &&
        (!Number.isInteger(maxResults) || maxResults < 1)
      ) {
        return fail("maxResults must be a positive integer.");
      }

      let pattern;
      try {
        pattern = new RegExp(args.isRegexp ? query : escapeRegExp(query), "i");
      } catch (err) {
        return fail(
          `Invalid search pattern: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const files = await getSearchFiles(args.includePattern);
      const results: { file: string; line: number; text: string }[] = [];

      for (const file of files) {
        try {
          const fullPath = getResolvedPath(file);
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split(/\r\n|\r|\n/);

          for (let index = 0; index < lines.length; index += 1) {
            const lineText = lines[index] ?? "";
            if (!pattern.test(lineText)) {
              continue;
            }

            results.push({
              file,
              line: index + 1,
              text: lineText.trim(),
            });

            if (maxResults !== undefined && results.length >= maxResults) {
              return ok(results);
            }
          }
        } catch {
          // Skip unreadable files and continue searching the workspace.
        }
      }

      return ok(results);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

const run_shell_command = {
  name: "run_shell_command",
  description: "This tool allows you to execute shell commands.",
  schema: z.object({
    command: z.string().describe("The shell command to run."),
  }),
  async execute(args: z.infer<typeof this.schema>) {
    try {
      const command = String(args.command ?? "").trim();
      if (!command) {
        return fail("Command must be a non-empty string.");
      }

      const result = await runCommand(command);
      return ok({
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

/** @type {{name: string, description: string, schema: z.ZodObject, execute: (...a:any[])=>any}[]} */
const ALL_TOOLS = [
  list_directory,
  read_file,
  create_file,
  update_file,
  file_search,
  grep_search,
  run_shell_command,
];

export function toolsToOllamaFormat() {
  return ALL_TOOLS.map<Tool>((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema.toJSONSchema() as any,
    },
  }));
}

export async function executeToolCall(name, rawArgs) {
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

  const result = await tool.execute(parsed.data as any);
  return {
    name,
    args,
    result,
  };
}

function getResolvedPath(unresolvedPath = "") {
  const requestedPath = unresolvedPath || ".";
  const resolvedPath = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(process.cwd(), requestedPath);

  const relative = path.relative(process.cwd(), resolvedPath);
  if (relative.startsWith("..")) {
    throw new Error(`Path is outside the workspace: ${unresolvedPath}`);
  }
  return resolvedPath;
}

function normalizeSearchPattern(query) {
  if (path.isAbsolute(query)) {
    const globIndex = findGlobIndex(query);

    if (globIndex === -1) {
      const resolved = getResolvedPath(query);
      return path.relative(process.cwd(), resolved);
    }

    const prefix = query.slice(0, globIndex);
    const remainder = query.slice(globIndex);
    const absolutePrefix = path.resolve(prefix);
    const relativePrefix = path.relative(process.cwd(), absolutePrefix);

    if (relativePrefix.startsWith("..")) {
      throw new Error("Search pattern must remain inside the workspace.");
    }

    const normalizedPrefix = relativePrefix.split(path.sep).join("/");
    return normalizedPrefix ? `${normalizedPrefix}/${remainder}` : remainder;
  }

  const globIndex = findGlobIndex(query);
  const prefix = globIndex === -1 ? query : query.slice(0, globIndex);
  const normalizedPrefix = path.normalize(prefix);

  if (normalizedPrefix.startsWith("..") || path.isAbsolute(normalizedPrefix)) {
    throw new Error("Search pattern must remain inside the workspace.");
  }

  return query;
}

async function getSearchFiles(includePattern) {
  const query = String(includePattern ?? "**/*").trim() || "**/*";

  if (findGlobIndex(query) === -1) {
    try {
      const resolvedPath = getResolvedPath(query);
      const stats = await fs.stat(resolvedPath);
      const relativePath = path
        .relative(process.cwd(), resolvedPath)
        .split(path.sep)
        .join("/");

      if (stats.isFile()) {
        return [relativePath];
      }

      if (stats.isDirectory()) {
        const directoryPattern = relativePath ? `${relativePath}/**/*` : "**/*";
        return await fg(directoryPattern, {
          cwd: process.cwd(),
          onlyFiles: true,
          dot: true,
          unique: true,
        });
      }
    } catch (err) {
      if (!(err instanceof Error && err["code"] === "ENOENT")) {
        throw err;
      }
    }
  }

  const normalizedPattern = normalizeSearchPattern(query);
  return await fg(normalizedPattern, {
    cwd: process.cwd(),
    onlyFiles: true,
    dot: true,
    unique: true,
  });
}

function findGlobIndex(pattern) {
  const special = new RegExp("[*?\\[\\]{}()]");
  const match = pattern.match(special);
  return match ? match.index : -1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function runCommand(command, args = []) {
  return new Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: true,
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code, signal) => {
      resolve({ stdout, stderr, code, signal });
    });
  });
}
