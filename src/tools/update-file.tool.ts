import { fail, getResolvedPath, inferTool, ok } from "./utils.ts";
import fs from "node:fs/promises";
import z from "zod";

export const update_file = inferTool({
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
