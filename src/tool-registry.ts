import { ToolCallSchema } from './schemas';
import type { RunContext, ToolAdapter, ToolCall, ToolRuntimeContext } from './types';

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
    execute: async ({ path }: Record<string, unknown>) => {
      return { path, content: `Stubbed read of ${String(path)}` };
    },
  });

  registry.register({
    name: 'shell',
    description: 'Run a shell command inside the workspace',
    execute: async ({ command }: Record<string, unknown>) => {
      return { command, output: `Stubbed shell execution for ${String(command)}` };
    },
  });

  registry.register({
    name: 'git',
    description: 'Inspect repository state using git',
    execute: async () => {
      return { status: 'stubbed', message: 'Git tool placeholder' };
    },
  });

  return registry;
}
