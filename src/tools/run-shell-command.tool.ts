import { fail, ok, runCommand, tool } from "./utils.ts";
import z from "zod";

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
          stdout: result.stdout,
          stderr: result.stderr,
        }),
      );
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
