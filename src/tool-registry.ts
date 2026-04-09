export interface ToolAdapter {
  name: string;
  description: string;
  execute(args: Record<string, unknown>): Promise<unknown>;
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
}

export function createBuiltinToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: 'file-read',
    description: 'Read a file from the repository workspace',
    execute: async ({ path }: Record<string, unknown>) => {
      return { path, content: `Stubbed read of ${path}` };
    },
  });

  registry.register({
    name: 'shell',
    description: 'Run a shell command inside the workspace',
    execute: async ({ command }: Record<string, unknown>) => {
      return { command, output: `Stubbed shell execution for ${command}` };
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
