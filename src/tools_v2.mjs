import { ellipsis } from "./utils.ts";
import { exec } from "node:child_process";
import fg from "fast-glob";
import fs from "fs-extra";
import path from "node:path";
import { z } from "zod";

// ---------- list_dir ----------
const listDirSchema = z.object({
  path: z.string().describe("Directory path relative to cwd"),
  recursive: z.boolean().optional().describe("List recursively"),
  pattern: z.string().optional().describe("Glob pattern to filter entries"),
});

const listDir = {
  name: "list_dir",
  description: "List contents of a directory",
  schema: listDirSchema,
  async execute(args) {
    try {
      const dirPath = resolveSandboxed(args.path);
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) return fail(`Not a directory: ${args.path}`);

      if (args.recursive || args.pattern) {
        const pattern = args.pattern ?? "**/*";
        const entries = await fg(pattern, {
          cwd: dirPath,
          dot: false,
          onlyFiles: false,
        });
        return ok(entries);
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return ok(items);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- read_file ----------
const readFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
  startLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("1-based start line"),
  endLine: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("1-based end line (inclusive)"),
  maxBytes: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Max bytes to read"),
});

const readFile = {
  name: "read_file",
  description: "Read contents of a file with optional line range",
  schema: readFileSchema,
  async execute(args) {
    try {
      const filePath = resolveSandboxed(args.path);
      if (isBinaryPath(filePath)) return fail("Cannot read binary file");
      const stat = await fs.stat(filePath);
      const limit = args.maxBytes ?? MAX_READ_BYTES;
      if (stat.size > MAX_FILE_SIZE)
        return fail(
          `File exceeds size limit (${stat.size} > ${MAX_FILE_SIZE})`,
        );

      const content = await fs.readFile(filePath, "utf-8");

      if (args.startLine || args.endLine) {
        const lines = content.split("\n");
        const start = (args.startLine ?? 1) - 1;
        const end = args.endLine ?? lines.length;
        return ok(ellipsis(lines.slice(start, end).join("\n"), limit));
      }

      return ok(content);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- write_file ----------
const writeFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
  content: z.string().describe("Content to write"),
  overwrite: z
    .boolean()
    .optional()
    .describe("Overwrite if exists (default: false)"),
});

const writeFile = {
  name: "write_file",
  description: "Write content to a file, creating directories as needed",
  schema: writeFileSchema,
  async execute(args) {
    try {
      const filePath = resolveSandboxed(args.path);
      if (isBinaryPath(filePath)) return fail("Cannot write binary file");
      if (Buffer.byteLength(args.content, "utf-8") > MAX_WRITE_BYTES) {
        return fail("Content exceeds write size limit");
      }

      const exists = await fs.pathExists(filePath);
      if (exists && !args.overwrite)
        return fail("File exists and overwrite is false");

      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, args.content, "utf-8");
      return ok({ written: filePath });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- append_file ----------
const appendFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
  content: z.string().describe("Content to append"),
});

const appendFile = {
  name: "append_file",
  description: "Append content to a file",
  schema: appendFileSchema,
  async execute(args) {
    try {
      const filePath = resolveSandboxed(args.path);
      if (isBinaryPath(filePath)) return fail("Cannot append to binary file");

      await fs.ensureDir(path.dirname(filePath));
      await fs.appendFile(filePath, args.content, "utf-8");
      return ok({ appended: filePath });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- replace_in_file ----------
const replaceInFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
  search: z.string().describe("String or regex to search"),
  replace: z.string().describe("Replacement string"),
  isRegex: z.boolean().optional().describe("Treat search as regex"),
  replaceAll: z
    .boolean()
    .optional()
    .describe("Replace all occurrences (default: true)"),
});

const replaceInFile = {
  name: "replace_in_file",
  description: "Search and replace text in a file",
  schema: replaceInFileSchema,
  async execute(args) {
    try {
      const filePath = resolveSandboxed(args.path);
      if (isBinaryPath(filePath)) return fail("Cannot edit binary file");

      const content = await fs.readFile(filePath, "utf-8");
      const doAll = args.replaceAll !== false;

      let newContent;
      let count = 0;

      if (args.isRegex) {
        const flags = doAll ? "g" : "";
        const regex = new RegExp(args.search, flags);
        newContent = content.replace(regex, () => {
          count++;
          return args.replace;
        });
      } else if (doAll) {
        const parts = content.split(args.search);
        count = parts.length - 1;
        newContent = parts.join(args.replace);
      } else {
        const idx = content.indexOf(args.search);
        if (idx === -1) {
          count = 0;
          newContent = content;
        } else {
          count = 1;
          newContent =
            content.slice(0, idx) +
            args.replace +
            content.slice(idx + args.search.length);
        }
      }

      if (count === 0) return fail("No matches found");

      await fs.writeFile(filePath, newContent, "utf-8");
      return ok({ replacements: count });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- delete_file ----------
const deleteFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
});

const deleteFileTool = {
  name: "delete_file",
  description: "Delete a file",
  schema: deleteFileSchema,
  async execute(args) {
    try {
      const filePath = resolveSandboxed(args.path);
      await fs.remove(filePath);
      return ok({ deleted: filePath });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- move_file ----------
const moveFileSchema = z.object({
  from: z.string().describe("Source path relative to cwd"),
  to: z.string().describe("Destination path relative to cwd"),
});

const moveFile = {
  name: "move_file",
  description: "Move or rename a file",
  schema: moveFileSchema,
  async execute(args) {
    try {
      const fromPath = resolveSandboxed(args.from);
      const toPath = resolveSandboxed(args.to);
      await fs.ensureDir(path.dirname(toPath));
      await fs.move(fromPath, toPath);
      return ok({ from: fromPath, to: toPath });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- mkdir ----------
const mkdirSchema = z.object({
  path: z.string().describe("Directory path relative to cwd"),
  recursive: z.boolean().optional().describe("Create parent directories"),
});

const mkdirTool = {
  name: "mkdir",
  description: "Create a directory",
  schema: mkdirSchema,
  async execute(args) {
    try {
      const dirPath = resolveSandboxed(args.path);
      await fs.mkdir(dirPath, { recursive: args.recursive !== false });
      return ok({ created: dirPath });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- glob_search ----------
const globSearchSchema = z.object({
  pattern: z.string().describe("Glob pattern"),
  cwd: z
    .string()
    .optional()
    .describe("Directory to search in (relative to sandbox)"),
});

const globSearch = {
  name: "glob_search",
  description: "Find files matching a glob pattern",
  schema: globSearchSchema,
  async execute(args) {
    try {
      const base = args.cwd ? resolveSandboxed(args.cwd) : process.cwd();
      const entries = await fg(args.pattern, { cwd: base, dot: false });
      return ok(entries);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- grep_search ----------
const grepSearchSchema = z.object({
  query: z.string().describe("Search string or regex"),
  includePattern: z.string().optional().describe("Glob to filter files"),
});

const grepSearch = {
  name: "grep_search",
  description: "Search file contents for a pattern",
  schema: grepSearchSchema,
  async execute(args) {
    try {
      const pattern = args.includePattern ?? "**/*";
      const files = await fg(pattern, {
        cwd: process.cwd(),
        dot: false,
        onlyFiles: true,
      });
      const regex = new RegExp(args.query, "gi");
      const results = [];

      for (const file of files) {
        const fullPath = path.join(process.cwd(), file);
        if (isBinaryPath(fullPath)) continue;
        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > MAX_FILE_SIZE) continue;
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            if (lineText !== undefined && regex.test(lineText)) {
              results.push({ file, line: i + 1, text: lineText.trim() });
              regex.lastIndex = 0;
            }
          }
        } catch {
          // skip files that can't be read
        }
      }
      return ok(results);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- execute_bash_command ----------
const executeBashCommandSchema = z.object({
  command: z
    .string()
    .describe(
      `The exact bash command to execute (e.g., 'git diff --cached', 'npm run test', 'python -c "import foo; foo.bar()"').`,
    ),
});
const executeBashCommand = {
  name: "execute_bash_command",
  description:
    "Executes a bash shell command on the host system. Use this to run scripts, utilities and other programs. Returns the terminal output.",
  schema: executeBashCommandSchema,
  execute: async (...args) => {
    const { command } = args[0];
    try {
      // Execute the command with a timeout to prevent infinite hangs
      const { stdout, stderr } = await new Promise((res, rej) =>
        exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
          if (error) rej(error);
          res({ stderr, stdout });
        }),
      );

      // If the command succeeds but writes to stderr (common for warnings)
      if (stderr && !stdout) {
        return ok(`Command executed with warnings/stderr:\n${stderr.trim()}`);
      }

      // Return standard output
      return ok(
        ellipsis(stdout.trim(), 5000) ||
          "Command executed successfully with no output.",
      );
    } catch (error) {
      // Return the error message to the AI so it knows what went wrong and can adapt
      return fail(
        `Execution Failed.\nExit Code: ${error.code}\nError: ${error.message}`,
      );
    }
  },
};

// ---------- Registry ----------
export const ALL_TOOLS = [
  listDir,
  readFile,
  writeFile,
  appendFile,
  replaceInFile,
  deleteFileTool,
  moveFile,
  mkdirTool,
  globSearch,
  grepSearch,
  executeBashCommand,
];

function getToolByName(name) {
  return ALL_TOOLS.find((t) => t.name === name);
}

/** Convert tool definitions to Ollama tool format */
/** @returns {import('ollama').Tool[]} */
export function toolsToOllamaFormat() {
  return ALL_TOOLS.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema.toJSONSchema(),
    },
  }));
}

/**
 * Resolve a user-supplied path and ensure it stays within the sandbox root.
 * Follows symlinks to block symlink escapes.
 */
function resolveSandboxed(userPath) {
  const sandbox = process.cwd();
  const resolved = path.resolve(sandbox, userPath);
  const normalSandbox = path.resolve(sandbox) + path.sep;
  const normalResolved = path.resolve(resolved);

  if (
    normalResolved !== path.resolve(sandbox) &&
    !normalResolved.startsWith(normalSandbox)
  ) {
    throw new Error(`Path escapes sandbox: ${userPath}`);
  }

  // If the file already exists, resolve symlinks and re-check
  try {
    const real = fs.realpathSync(normalResolved);
    const realSandbox = fs.realpathSync(path.resolve(sandbox)) + path.sep;
    const realSandboxRoot = fs.realpathSync(path.resolve(sandbox));
    if (real !== realSandboxRoot && !real.startsWith(realSandbox)) {
      throw new Error(`Symlink escapes sandbox: ${userPath}`);
    }
    return real;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      // File doesn't exist yet — the lexical check above is sufficient
      return normalResolved;
    }
    throw err;
  }
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
  ".pdf",
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
]);

function isBinaryPath(filePath) {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Max file size for read operations (5 MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Max bytes for read operations (0.5 MB) */
const MAX_READ_BYTES = 0.5 * 1024 * 1024;

/** Max bytes for write operations (0.5 MB) */
const MAX_WRITE_BYTES = 0.5 * 1024 * 1024;

function ok(data) {
  return { success: true, data };
}

function fail(error) {
  return { success: false, error };
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

export async function executeToolCall(name, rawArgs) {
  let args = {};

  try {
    args = parseToolArgs(rawArgs);
  } catch (err) {
    return {
      name,
      args,
      result: {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const tool = getToolByName(name);
  if (!tool) {
    return {
      name,
      args,
      result: {
        success: false,
        error: `Unknown tool: ${name}`,
      },
    };
  }

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    return {
      name,
      args,
      result: {
        success: false,
        error: `Validation error: ${parsed.error.message}`,
      },
    };
  }

  const result = await tool.execute(parsed.data);
  return {
    name,
    args,
    result,
  };
}
