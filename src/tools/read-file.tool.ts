import fs from "node:fs/promises";
import z from "zod";
import { fail, getResolvedPath, ok, tool } from "./utils.ts";

export const read_file = tool({
  name: "read_file",
  description:
    "Read the contents of a file. You must specify the line range you're interested in. Line numbers are 1-indexed.",
  schema: z.object({
    path: z.string().describe("The relative path of the file to read."),
    start_line: z
      .number()
      .optional()
      .describe("The 1-indexed line number where the reading should begin."),
    end_line: z
      .number()
      .optional()
      .describe(
        "The 1-indexed line number where the reading should end (inclusive).",
      ),
  }),
  async execute(args) {
    try {
      const resolvedPath = getResolvedPath(args.path);
      const stats = await fs.stat(resolvedPath);

      if (!stats.isFile()) {
        return fail(`Not a file: ${args.path}`);
      }

      const content = await fs.readFile(resolvedPath, "utf-8");

      if (!args.start_line && !args.end_line) {
        if (content.length > 20_000)
          throw new Error(
            "This file is too large. You should use `start_line` and `end_line` to read only a section of the file.",
          );
      }

      const lines = content.split(/\r\n|\r|\n/);
      const startIndex = (args.start_line ?? 1) - 1;
      const endIndex = Math.min(lines.length, args.end_line ?? lines.length);

      return ok(lines.slice(startIndex, endIndex).join("\n"));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
