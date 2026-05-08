import { fail, getResolvedPath, ok, tool } from "./utils.ts";
import fs from "node:fs/promises";
import z from "zod";

export const update_file = tool({
  name: "update_file",
  description: "Update an existing file by replacing exact text with new text.",
  schema: z.object({
    file_path: z.string().describe("The relative path of the file to update."),
    old_text: z.string().describe("The exact text to replace."),
    content: z.string().describe("The new text to write."),
  }),
  async execute(args) {
    try {
      const resolvedPath = getResolvedPath(args.file_path);
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return fail(`Not a file: ${args.file_path}`);
      }

      const original = await fs.readFile(resolvedPath, "utf-8");
      const replacement = args.content;
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
