#!/usr/bin/env node
import { Command } from "commander";
import { initLogger } from "../lib/logger.js";
import { chatCommand } from "../cli/chat.js";
import { runCommand } from "../cli/run.js";
import { toolsCommand } from "../cli/tools.js";
import type { AgentOptions } from "../lib/types.js";
import path from "node:path";
import pc from "picocolors";

const program = new Command();

program
  .name("minicode")
  .description("CLI AI agent powered by Ollama")
  .version("1.0.0")
  .option("--model <model>", "Ollama model to use", "gpt-oss:20b")
  .option("--host <url>", "Ollama host URL", "http://127.0.0.1:11434")
  .option("--cwd <path>", "Working directory for file operations", process.cwd())
  .option("--max-steps <n>", "Maximum autonomous steps", "20")
  .option("--json", "Machine-readable JSON output", false)
  .option("--verbose", "Show detailed logs", false);

function resolveOpts(cmd: Command): AgentOptions {
  const parent = cmd.parent ?? cmd;
  const rawOpts = parent.opts() as {
    model: string;
    host: string;
    cwd: string;
    maxSteps: string;
    json: boolean;
    verbose: boolean;
  };
  return {
    model: rawOpts.model,
    host: rawOpts.host,
    cwd: path.resolve(rawOpts.cwd),
    maxSteps: parseInt(rawOpts.maxSteps, 10),
    json: rawOpts.json,
    verbose: rawOpts.verbose,
  };
}

program
  .command("chat")
  .description("Interactive chat REPL with streaming")
  .action(async function (this: Command) {
    const opts = resolveOpts(this);
    initLogger(opts.verbose);
    try {
      await chatCommand(opts);
    } catch (err: unknown) {
      console.error(pc.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command("run <task>")
  .description("Run an autonomous task")
  .action(async function (this: Command, task: string) {
    const opts = resolveOpts(this);
    initLogger(opts.verbose);
    try {
      await runCommand(task, opts);
    } catch (err: unknown) {
      console.error(pc.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command("tools")
  .description("List available tools and schemas")
  .action(function (this: Command) {
    const opts = resolveOpts(this);
    toolsCommand(opts.json);
  });

program.parse();
