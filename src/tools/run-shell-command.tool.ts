import { fail, ok, tool } from "./utils.ts";
import { spawn } from "node:child_process";
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
      return ok({
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

function runCommand(command, args = []) {
  return new Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: true,
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code, signal) => {
      resolve({ stdout, stderr, code, signal });
    });
  });
}
