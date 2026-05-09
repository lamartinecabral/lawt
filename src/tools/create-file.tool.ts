import { fail, getResolvedPath, ok, tool } from "./utils.ts";
import fs from "node:fs/promises";
import path from "node:path";
import z from "zod";

export const create_file = tool({
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

      return ok(`file created: ${resolvedPath}`);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
