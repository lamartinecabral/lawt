import { fail, getResolvedPath, makeTool, ok } from "./utils.ts";
import fs from "node:fs/promises";
import z from "zod";

export const read_file = makeTool({
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
