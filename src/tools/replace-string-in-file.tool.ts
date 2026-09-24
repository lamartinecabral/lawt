import fs from "node:fs/promises";
import path from "node:path";
import z from "zod";
import { fail, getResolvedPath, ok, tool } from "./utils.ts";

export const replace_string_in_file = tool({
  name: "replace_string_in_file",
  description:
    "This tool allows you to replace a specific string in a file with a new string.",
  schema: z.object({
    path: z.string().describe("The relative path of the file to update."),
    old_text: z
      .string()
      .describe("The exact text in the file that should be replaced."),
    new_text: z
      .string()
      .describe("The new text that will replace the old text."),
  }),
  async execute(args) {
    try {
      const resolvedPath = getResolvedPath(args.path);
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return fail(`Not a file: ${args.path}`);
      }

      const original = await fs.readFile(resolvedPath, "utf-8");
      const replacement = args.new_text;
      let updated = original;

      if (args.old_text.length === 0) {
        return fail("Invalid old_text: must not be empty.");
      }

      const occurrences = original.split(args.old_text).length - 1;
      if (occurrences === 0) {
        return fail(`Text not found in file: ${args.old_text}`);
      }

      if (occurrences > 1) {
        return fail(
          "Text to replace must be unique within the file. Provide a more specific old_text.",
        );
      }

      updated = original.replace(args.old_text, replacement);

      const relativePath = path.relative(process.cwd(), resolvedPath);

      if (updated === original) {
        return ok(`file updated: ${relativePath} (no changes made)`);
      }

      await fs.writeFile(resolvedPath, updated, "utf-8");
      return ok(`file updated: ${relativePath}`);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
