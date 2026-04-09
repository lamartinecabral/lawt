import { describe, expect, test } from 'vitest';
import { createDeterministicPlan, executePlanSteps } from '../src/orchestrator';
import { buildRepositoryContext } from '../src/context';
import type { RunContext, ToolAdapter, ToolRegistry } from '../src/types';

const noopLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as const;

const stubContext: RunContext = {
  runId: 'run-test',
  sessionId: 'session-test',
  startedAt: new Date().toISOString(),
  config: {
    cwd: process.cwd(),
    dryRun: true,
    json: false,
    verbose: false,
    approval: 'auto',
    ignorePatterns: [],
  },
};

const createStubRegistry = (adapter: ToolAdapter): ToolRegistry => {
  return {
    register: () => null as any,
    get: () => adapter,
    list: () => [adapter],
    execute: async (name: string, args: Record<string, unknown>) => ({
      name,
      arguments: args,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      success: true,
      output: args,
    }),
  } as unknown as ToolRegistry;
};

describe('orchestrator', () => {
  test('createDeterministicPlan returns a plan for plan command', async () => {
    const repositoryContext = await buildRepositoryContext(process.cwd(), []);
    const steps = await createDeterministicPlan('plan', 'update README', repositoryContext, stubContext);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ id: 'analyze-task', tool: 'file-search' });
    expect(steps[1]).toMatchObject({ id: 'draft-plan', tool: undefined });
  });

  test('executePlanSteps transitions step states and returns ok', async () => {
    const repositoryContext = await buildRepositoryContext(process.cwd(), []);
    const steps = await createDeterministicPlan('plan', 'update README', repositoryContext, stubContext);
    const registry = createStubRegistry({
      name: 'file-search',
      description: 'stub search',
      execute: async () => ({ query: 'update README', results: [] }),
    });

    const summary = await executePlanSteps(steps, registry, stubContext, noopLogger, 'plan');

    expect(summary.status).toBe('ok');
    expect(summary.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(summary.artifacts).toEqual(expect.arrayContaining([expect.stringContaining('analyze-task')]));
  });
});
