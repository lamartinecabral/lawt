import z from "zod";
import { fail, ok, runCommand, tool } from "./utils.ts";

export const run_shell_command = tool({
  name: "run_shell_command",
  description: "This tool allows you to execute shell commands.",
  schema: z.object({
    command: z.string().describe("The shell command to run."),
  }),
  async execute(args) {
    try {
      const command = String(args.command ?? "").trim();
      if (!command) {
        return fail("Command must be a non-empty string.");
      }

      const result = await runCommand(command);
      return ok(
        JSON.stringify({
          ...(result.stdout ? { stdout: result.stdout } : {}),
          ...(result.stderr ? { stderr: result.stderr } : {}),
        }),
      );
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
