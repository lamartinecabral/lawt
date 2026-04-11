import readline from "node:readline";
import { createOllamaClient, streamChat, getSystemPrompt } from "../agent/index.js";
import type { AgentOptions } from "../lib/types.js";
import pc from "picocolors";
import ora from "ora";

function formatThinkLabel(think: AgentOptions["think"]): string {
  if (think === undefined) return "default";
  if (think === true) return "on";
  if (think === false) return "off";
  return think;
}

export async function chatCommand(opts: AgentOptions): Promise<void> {
  const client = await createOllamaClient({ host: opts.host, model: opts.model });

  console.log(pc.bold("minicode chat"));
  console.log(
    pc.dim(
      `Model: ${opts.model} | Think: ${formatThinkLabel(opts.think)} | Type "exit" or Ctrl+C to quit.\n`,
    ),
  );

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: getSystemPrompt() },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: pc.green("you> "),
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const input = line.trim();
    if (input === "exit" || input === "quit") {
      rl.close();
      return;
    }
    if (!input) {
      rl.prompt();
      return;
    }

    messages.push({ role: "user", content: input });

    const spinner = ora({
      stream: process.stderr,
    }).start();

    let fullResponse = "";
    let wrotePrefix = false;
    try {
      for await (const token of streamChat(client, messages, opts.model, opts.think)) {
        if (!wrotePrefix) {
          spinner.stop();
          process.stdout.write(pc.blue("bot> "));
          wrotePrefix = true;
        }
        process.stdout.write(token);
        fullResponse += token;
      }

      if (!wrotePrefix) {
        spinner.stop();
        process.stdout.write(pc.blue("bot> "));
      }
    } catch (err: unknown) {
      spinner.stop();
      console.error(pc.red(`\nError: ${err instanceof Error ? err.message : String(err)}`));
    }
    console.log();
    messages.push({ role: "assistant", content: fullResponse });
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(pc.dim("\nGoodbye."));
    process.exit(0);
  });
}
