import fs from 'fs/promises';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { ToolCallSchema } from './schemas';
import { resolveRepositoryPath, readWorkspaceFile, searchWorkspace } from './context';
import type {
  RunContext,
  ToolAdapter,
  ToolCall,
  ToolRuntimeContext,
  PolicyDecision,
} from './types';

const exec = promisify(execCallback);

function isDangerousShellCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return [
    /rm\s+-rf\s+\//,
    /sudo\s+/,
    /shutdown\b/,
    /reboot\b/,
    /mkfs\b/,
    /dd\s+if=/,
    /:\(\)\s*\{\s*:\|\s*&\s*\};?\s*/,
  ].some((pattern) => pattern.test(normalized));
}

function buildPolicyDecision(
  config: RunContext['config'],
  toolName: string,
  args: Record<string, unknown>,
): PolicyDecision {
  if (toolName === 'shell') {
    const command = String(args.command ?? '').trim();
    if (!command) {
      return { action: 'deny', reason: 'Shell command cannot be empty' };
    }
    if (isDangerousShellCommand(command)) {
      return { action: 'deny', reason: 'Shell command matches blocked dangerous patterns' };
    }

    return { action: 'review', reason: 'Shell command execution requires approval' };
  }

  if (toolName === 'file-read' || toolName === 'file-edit') {
    const candidate = String(args.path ?? '');
    try {
      resolveRepositoryPath(config.cwd, candidate);
    } catch (error) {
      return {
        action: 'deny',
        reason: `File path is outside the workspace boundary: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    if (toolName === 'file-edit') {
      return { action: 'review', reason: 'File edits require approval' };
    }
  }

  return { action: 'allow', reason: 'Tool call is permitted under current policy' };
}

export class ToolRegistry {
  private adapters = new Map<string, ToolAdapter>();

  register(tool: ToolAdapter): this {
    this.adapters.set(tool.name, tool);
    return this;
  }

  get(name: string): ToolAdapter | undefined {
    return this.adapters.get(name);
  }

  list(): ToolAdapter[] {
    return Array.from(this.adapters.values());
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: RunContext,
  ): Promise<ToolCall> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Tool adapter not found: ${name}`);
    }

    const startedAt = new Date().toISOString();
    const policy = buildPolicyDecision(context.config, name, args);
    if (policy.action === 'deny') {
      const deniedCall: ToolCall = {
        name,
        arguments: args,
        startedAt,
        endedAt: new Date().toISOString(),
        success: false,
        error: `Policy denied tool call: ${policy.reason}`,
      };
      ToolCallSchema.parse(deniedCall);
      return deniedCall;
    }

    if (
      policy.action === 'review' &&
      !context.config.dryRun &&
      context.config.approval !== 'auto'
    ) {
      const reviewCall: ToolCall = {
        name,
        arguments: args,
        startedAt,
        endedAt: new Date().toISOString(),
        success: false,
        error: `Tool call requires approval under ${context.config.approval} mode: ${policy.reason}`,
      };
      ToolCallSchema.parse(reviewCall);
      return reviewCall;
    }

    try {
      const runtimeContext: ToolRuntimeContext = { runContext: context };
      const output = await adapter.execute(args, runtimeContext);
      const toolCall: ToolCall = {
        name,
        arguments: args,
        startedAt,
        endedAt: new Date().toISOString(),
        success: true,
        output,
      };
      ToolCallSchema.parse(toolCall);
      return toolCall;
    } catch (error) {
      const toolCall: ToolCall = {
        name,
        arguments: args,
        startedAt,
        endedAt: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      ToolCallSchema.parse(toolCall);
      return toolCall;
    }
  }
}

export function createBuiltinToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: 'file-read',
    description: 'Read a file from the repository workspace',
    execute: async ({ path: filePath }: Record<string, unknown>, context: ToolRuntimeContext) => {
      const resolvedPath = String(filePath ?? '');
      const content = await readWorkspaceFile(context.runContext.config.cwd, resolvedPath);
      return { path: resolvedPath, content };
    },
  });

  registry.register({
    name: 'file-search',
    description: 'Search file contents across the repository workspace',
    execute: async ({ query }: Record<string, unknown>, context: ToolRuntimeContext) => {
      const searchQuery = String(query ?? '');
      const results = await searchWorkspace(
        context.runContext.config.cwd,
        searchQuery,
        context.runContext.config.ignorePatterns ?? [],
      );
      return { query: searchQuery, results };
    },
  });

  registry.register({
    name: 'file-edit',
    description: 'Write content to a file in the repository workspace',
    execute: async (
      { path: filePath, content }: Record<string, unknown>,
      context: ToolRuntimeContext,
    ) => {
      const targetPath = String(filePath ?? '');
      const newContent = String(content ?? '');
      const absolutePath = resolveRepositoryPath(context.runContext.config.cwd, targetPath);
      const existingContent = await fs.readFile(absolutePath, 'utf8').catch(() => undefined);

      if (context.runContext.config.dryRun) {
        return {
          path: targetPath,
          updated: existingContent !== newContent,
          dryRun: true,
          before: existingContent ?? null,
          after: newContent,
        };
      }

      await fs.writeFile(absolutePath, newContent, 'utf8');
      return {
        path: targetPath,
        updated: existingContent !== newContent,
        dryRun: false,
        before: existingContent ?? null,
        after: newContent,
      };
    },
  });

  registry.register({
    name: 'shell',
    description: 'Run a shell command inside the workspace',
    execute: async ({ command }: Record<string, unknown>, context: ToolRuntimeContext) => {
      const shellCommand = String(command ?? '').trim();
      if (context.runContext.config.dryRun) {
        return { command: shellCommand, dryRun: true, message: 'Dry-run shell execution skipped' };
      }

      try {
        const result = await exec(shellCommand, {
          cwd: context.runContext.config.cwd,
          timeout: 30_000,
          env: process.env,
        });
        return { command: shellCommand, stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
      } catch (error) {
        return {
          command: shellCommand,
          stdout: (error as any).stdout ?? '',
          stderr: (error as any).stderr ?? String(error),
          exitCode: (error as any).code ?? 1,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  registry.register({
    name: 'git',
    description: 'Inspect repository state using git',
    execute: async (_args: Record<string, unknown>, context: ToolRuntimeContext) => {
      if (context.runContext.config.dryRun) {
        return { status: 'dry-run', message: 'Git inspection skipped during dry run' };
      }

      try {
        const root = context.runContext.config.cwd;
        const { stdout: insideTree } = await exec('git rev-parse --is-inside-work-tree', {
          cwd: root,
          timeout: 10_000,
          env: process.env,
        });
        const { stdout: status } = await exec('git status --short --untracked-files=no', {
          cwd: root,
          timeout: 10_000,
          env: process.env,
        });
        return {
          insideWorkTree: insideTree.trim(),
          status: status.trim(),
        };
      } catch (error) {
        return {
          status: 'unavailable',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  registry.register({
    name: 'run-tests',
    description: 'Run repository validation tests',
    execute: async ({ command }: Record<string, unknown>, context: ToolRuntimeContext) => {
      const validationCommand = String(command ?? 'npm test').trim();
      if (context.runContext.config.dryRun) {
        return {
          command: validationCommand,
          dryRun: true,
          message: 'Dry-run test execution skipped',
        };
      }

      try {
        const result = await exec(validationCommand, {
          cwd: context.runContext.config.cwd,
          timeout: 120_000,
          env: process.env,
        });
        return {
          command: validationCommand,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: 0,
        };
      } catch (error) {
        return {
          command: validationCommand,
          stdout: (error as any).stdout ?? '',
          stderr: (error as any).stderr ?? String(error),
          exitCode: (error as any).code ?? 1,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  return registry;
}
