import readline from "node:readline";
import { createOllamaClient, runChatTurn, getSystemPrompt } from "../agent/index.js";
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

  const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }> = [
    { role: "system", content: getSystemPrompt() },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: pc.green("you> "),
  });

  rl.prompt();

  async function handleLine(line: string): Promise<void> {
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
      text: "processing...",
      stream: process.stderr,
    }).start();

    try {
      const result = await runChatTurn(client, messages, opts);
      spinner.stop();

      for (const event of result.events) {
        if (event.type === "thinking") {
          const formatted = event.text.replace(/\n/g, "\n       ");
          process.stdout.write(pc.magenta("think> "));
          process.stdout.write(pc.dim(formatted));
          process.stdout.write("\n");
          continue;
        }

        process.stdout.write(pc.yellow("tool> "));
        process.stdout.write(`${event.name}(${JSON.stringify(event.args)})\n`);
      }

      process.stdout.write(pc.blue("bot> "));
      process.stdout.write(result.response);
      if (opts.verbose && result.errors.length > 0) {
        process.stdout.write(pc.red(`\n  tool errors: ${result.errors.join("; ")}`));
      }
    } catch (err: unknown) {
      spinner.stop();
      console.error(pc.red(`\nError: ${err instanceof Error ? err.message : String(err)}`));
    }
    console.log();
    rl.prompt();
  }

  let lineQueue = Promise.resolve();
  rl.on("line", (line: string) => {
    lineQueue = lineQueue
      .then(async () => {
        await handleLine(line);
      })
      .catch((err: unknown) => {
        console.error(pc.red(`\nError: ${err instanceof Error ? err.message : String(err)}`));
      });
  });

  rl.on("close", () => {
    void lineQueue.finally(() => {
      console.log(pc.dim("\nGoodbye."));
      process.exit(0);
    });
  });
}
