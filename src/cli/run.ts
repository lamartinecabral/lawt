import { createOllamaClient, runAgent } from "../agent/index.js";
import type { AgentOptions } from "../lib/types.js";
import pc from "picocolors";
import ora from "ora";

function formatThinkLabel(think: AgentOptions["think"]): string {
  if (think === undefined) return "default";
  if (think === true) return "on";
  if (think === false) return "off";
  return think;
}

export async function runCommand(task: string, opts: AgentOptions): Promise<void> {
  const client = await createOllamaClient({ host: opts.host, model: opts.model });

  if (!opts.json) {
    console.log(pc.bold(`Running task: ${task}`));
    console.log(
      pc.dim(
        `Model: ${opts.model} | Think: ${formatThinkLabel(opts.think)} | Max steps: ${opts.maxSteps} | CWD: ${opts.cwd}\n`,
      ),
    );
  }

  const spinner =
    opts.json || opts.verbose
      ? undefined
      : ora({ text: "working...", stream: process.stderr }).start();

  const result = await runAgent(client, task, opts).finally(() => {
    spinner?.stop();
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(pc.bold("\n--- Result ---"));
    console.log(result.finalResponse);
    if (result.changedFiles.length > 0) {
      console.log(pc.dim(`\nChanged files: ${result.changedFiles.join(", ")}`));
    }
    if (result.errors.length > 0) {
      console.log(pc.red(`\nErrors: ${result.errors.join(", ")}`));
    }
  }
}
