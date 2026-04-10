import { z } from "zod";
import fs from "fs-extra";
import path from "node:path";
import type { ToolDefinition, ToolResult } from "../lib/types.js";
import { resolveSandboxed, isBinaryPath, MAX_READ_BYTES, MAX_WRITE_BYTES } from "../lib/sandbox.js";
import fg from "fast-glob";

function ok(data: unknown): ToolResult {
  return { success: true, data };
}

function fail(error: string): ToolResult {
  return { success: false, error };
}

// ---------- list_dir ----------
const listDirSchema = z.object({
  path: z.string().describe("Directory path relative to cwd"),
  recursive: z.boolean().optional().describe("List recursively"),
  pattern: z.string().optional().describe("Glob pattern to filter entries"),
});

const listDir: ToolDefinition<typeof listDirSchema> = {
  name: "list_dir",
  description: "List contents of a directory",
  schema: listDirSchema,
  async execute(args, sandbox) {
    try {
      const dirPath = resolveSandboxed(args.path, sandbox);
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) return fail(`Not a directory: ${args.path}`);

      if (args.recursive || args.pattern) {
        const pattern = args.pattern ?? "**/*";
        const entries = await fg(pattern, { cwd: dirPath, dot: false, onlyFiles: false });
        return ok(entries);
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return ok(items);
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- read_file ----------
const readFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
  startLine: z.number().int().positive().optional().describe("1-based start line"),
  endLine: z.number().int().positive().optional().describe("1-based end line (inclusive)"),
  maxBytes: z.number().int().positive().optional().describe("Max bytes to read"),
});

const readFile: ToolDefinition<typeof readFileSchema> = {
  name: "read_file",
  description: "Read contents of a file with optional line range",
  schema: readFileSchema,
  async execute(args, sandbox) {
    try {
      const filePath = resolveSandboxed(args.path, sandbox);
      if (isBinaryPath(filePath)) return fail("Cannot read binary file");    
      const stat = await fs.stat(filePath);
      const limit = args.maxBytes ?? MAX_READ_BYTES;
      if (stat.size > limit) return fail(`File exceeds size limit (${stat.size} > ${limit})`);

      const content = await fs.readFile(filePath, "utf-8");

      if (args.startLine || args.endLine) {
        const lines = content.split("\n");
        const start = (args.startLine ?? 1) - 1;
        const end = args.endLine ?? lines.length;
        return ok(lines.slice(start, end).join("\n"));
      }

      return ok(content);
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- write_file ----------
const writeFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
  content: z.string().describe("Content to write"),
  overwrite: z.boolean().optional().describe("Overwrite if exists (default: false)"),
});

const writeFile: ToolDefinition<typeof writeFileSchema> = {
  name: "write_file",
  description: "Write content to a file, creating directories as needed",
  schema: writeFileSchema,
  async execute(args, sandbox) {
    try {
      const filePath = resolveSandboxed(args.path, sandbox);
      if (isBinaryPath(filePath)) return fail("Cannot write binary file");
      if (Buffer.byteLength(args.content, "utf-8") > MAX_WRITE_BYTES) {
        return fail("Content exceeds write size limit");
      }

      const exists = await fs.pathExists(filePath);
      if (exists && !args.overwrite) return fail("File exists and overwrite is false");

      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, args.content, "utf-8");
      return ok({ written: filePath });
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- append_file ----------
const appendFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
  content: z.string().describe("Content to append"),
});

const appendFile: ToolDefinition<typeof appendFileSchema> = {
  name: "append_file",
  description: "Append content to a file",
  schema: appendFileSchema,
  async execute(args, sandbox) {
    try {
      const filePath = resolveSandboxed(args.path, sandbox);
      if (isBinaryPath(filePath)) return fail("Cannot append to binary file");

      await fs.ensureDir(path.dirname(filePath));
      await fs.appendFile(filePath, args.content, "utf-8");
      return ok({ appended: filePath });
    } catch (err: unknown) {
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
  replaceAll: z.boolean().optional().describe("Replace all occurrences (default: true)"),
});

const replaceInFile: ToolDefinition<typeof replaceInFileSchema> = {
  name: "replace_in_file",
  description: "Search and replace text in a file",
  schema: replaceInFileSchema,
  async execute(args, sandbox) {
    try {
      const filePath = resolveSandboxed(args.path, sandbox);
      if (isBinaryPath(filePath)) return fail("Cannot edit binary file");

      const content = await fs.readFile(filePath, "utf-8");
      const doAll = args.replaceAll !== false;

      let newContent: string;
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
            content.slice(0, idx) + args.replace + content.slice(idx + args.search.length);
        }
      }

      if (count === 0) return fail("No matches found");

      await fs.writeFile(filePath, newContent, "utf-8");
      return ok({ replacements: count });
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- delete_file ----------
const deleteFileSchema = z.object({
  path: z.string().describe("File path relative to cwd"),
});

const deleteFileTool: ToolDefinition<typeof deleteFileSchema> = {
  name: "delete_file",
  description: "Delete a file",
  schema: deleteFileSchema,
  async execute(args, sandbox) {
    try {
      const filePath = resolveSandboxed(args.path, sandbox);
      await fs.remove(filePath);
      return ok({ deleted: filePath });
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- move_file ----------
const moveFileSchema = z.object({
  from: z.string().describe("Source path relative to cwd"),
  to: z.string().describe("Destination path relative to cwd"),
});

const moveFile: ToolDefinition<typeof moveFileSchema> = {
  name: "move_file",
  description: "Move or rename a file",
  schema: moveFileSchema,
  async execute(args, sandbox) {
    try {
      const fromPath = resolveSandboxed(args.from, sandbox);
      const toPath = resolveSandboxed(args.to, sandbox);
      await fs.ensureDir(path.dirname(toPath));
      await fs.move(fromPath, toPath);
      return ok({ from: fromPath, to: toPath });
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- mkdir ----------
const mkdirSchema = z.object({
  path: z.string().describe("Directory path relative to cwd"),
  recursive: z.boolean().optional().describe("Create parent directories"),
});

const mkdirTool: ToolDefinition<typeof mkdirSchema> = {
  name: "mkdir",
  description: "Create a directory",
  schema: mkdirSchema,
  async execute(args, sandbox) {
    try {
      const dirPath = resolveSandboxed(args.path, sandbox);
      await fs.mkdir(dirPath, { recursive: args.recursive !== false });
      return ok({ created: dirPath });
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- glob_search ----------
const globSearchSchema = z.object({
  pattern: z.string().describe("Glob pattern"),
  cwd: z.string().optional().describe("Directory to search in (relative to sandbox)"),
});

const globSearch: ToolDefinition<typeof globSearchSchema> = {
  name: "glob_search",
  description: "Find files matching a glob pattern",
  schema: globSearchSchema,
  async execute(args, sandbox) {
    try {
      const base = args.cwd ? resolveSandboxed(args.cwd, sandbox) : sandbox;
      const entries = await fg(args.pattern, { cwd: base, dot: false });
      return ok(entries);
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- grep_search ----------
const grepSearchSchema = z.object({
  query: z.string().describe("Search string or regex"),
  includePattern: z.string().optional().describe("Glob to filter files"),
});

const grepSearch: ToolDefinition<typeof grepSearchSchema> = {
  name: "grep_search",
  description: "Search file contents for a pattern",
  schema: grepSearchSchema,
  async execute(args, sandbox) {
    try {
      const pattern = args.includePattern ?? "**/*";
      const files = await fg(pattern, { cwd: sandbox, dot: false, onlyFiles: true });
      const regex = new RegExp(args.query, "gi");
      const results: Array<{ file: string; line: number; text: string }> = [];

      for (const file of files) {
        const fullPath = path.join(sandbox, file);
        if (isBinaryPath(fullPath)) continue;
        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > MAX_READ_BYTES) continue;
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
    } catch (err: unknown) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------- Registry ----------
export const ALL_TOOLS: ToolDefinition[] = [
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
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/** Convert tool definitions to Ollama tool format */
export function toolsToOllamaFormat(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return ALL_TOOLS.map((tool) => {
    const jsonSchema = zodToJsonSchema(tool.schema);
    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: jsonSchema,
      },
    };
  });
}

/**
 * Minimal zod-to-JSON-Schema converter for object schemas with
 * string, number, boolean, and optional fields.
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const result: Record<string, unknown> = { type: "object", properties: {} };
  const required: string[] = [];

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, Record<string, unknown>> = {};

    for (const [key, value] of Object.entries(shape)) {
      let fieldSchema = value;
      let isOptional = false;

      if (fieldSchema instanceof z.ZodOptional) {
        isOptional = true;
        fieldSchema = fieldSchema.unwrap() as z.ZodType;
      }

      const prop: Record<string, unknown> = {};
      if (fieldSchema instanceof z.ZodString) {
        prop.type = "string";
      } else if (fieldSchema instanceof z.ZodNumber) {
        prop.type = "number";
      } else if (fieldSchema instanceof z.ZodBoolean) {
        prop.type = "boolean";
      } else {
        prop.type = "string";
      }

      if (fieldSchema.description) {
        prop.description = fieldSchema.description;
      }

      properties[key] = prop;
      if (!isOptional) {
        required.push(key);
      }
    }

    result.properties = properties;
    if (required.length > 0) {
      result.required = required;
    }
  }

  return result;
}
