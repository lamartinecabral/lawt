import { createOllamaClient, runAgent } from "../agent/index.js";
import type { AgentOptions } from "../lib/types.js";
import pc from "picocolors";

export async function runCommand(task: string, opts: AgentOptions): Promise<void> {
  const client = await createOllamaClient({ host: opts.host, model: opts.model });

  if (!opts.json) {
    console.log(pc.bold(`Running task: ${task}`));
    console.log(pc.dim(`Model: ${opts.model} | Max steps: ${opts.maxSteps} | CWD: ${opts.cwd}\n`));
  }

  const result = await runAgent(client, task, opts);

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
