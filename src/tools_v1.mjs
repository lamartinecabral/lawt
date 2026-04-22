// @ts-check
import { ellipsis } from "./utils.mjs";
import { exec } from "node:child_process";

/** @typedef {{definition: import("ollama").Tool, execute: (...args: any[]) => Promise<string>}} Tool */

/** @type {Tool} */
const run_bash_command = {
  definition: {
    type: "function",
    function: {
      name: "run_bash_command",
      description:
        "Executes a bash shell command on the host system. Use this to read files, navigate the directory, install packages, or run scripts. Returns the terminal output.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The exact bash command to run (e.g., 'ls -la', 'cat file.txt', 'mkdir new_folder').",
          },
        },
        required: ["command"],
      },
    },
  },
  execute: async ({ command }) => {
    try {
      // Execute the command with a timeout to prevent infinite hangs
      const { stdout, stderr } = await new Promise((res, rej) =>
        exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
          if (error) rej(error);
          res({ stderr, stdout });
        }),
      );

      // If the command succeeds but writes to stderr (common for warnings)
      if (stderr && !stdout) {
        return `Command executed with warnings/stderr:\n${stderr.trim()}`;
      }

      // Return standard output
      return (
        ellipsis(stdout.trim(), 5000) ||
        "Command executed successfully with no output."
      );
    } catch (error) {
      // Return the error message to the AI so it knows what went wrong and can adapt
      // @ts-ignore
      return `Execution Failed.\nExit Code: ${error.code}\nError: ${error.message}`;
    }
  },
};

/** @type {Record<string, Tool>} */
const toolRegistry = {
  run_bash_command,
};

export async function executeToolCall(name, rawArgs) {
  return await (name in toolRegistry
    ? toolRegistry[name]?.execute(rawArgs)
    : "tool not found");
}

export const toolsToOllamaFormat = () => {
  return Object.values(toolRegistry).map((a) => a.definition);
};
