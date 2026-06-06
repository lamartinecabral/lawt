import { fail, getResolvedPath, ok, tool } from "./utils.ts";
import fs from "node:fs/promises";
import z from "zod";

export const list_directory = tool({
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
      const sorted = entries.slice().sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      const list = sorted.map((entry) =>
        entry.isDirectory() ? `${entry.name}/` : entry.name,
      );

      return ok(list.join("\n") || "Directory is empty");
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
