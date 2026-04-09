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
    const steps = await createDeterministicPlan(
      'plan',
      'update README',
      repositoryContext,
      stubContext,
    );

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ id: 'analyze-task', tool: 'file-search' });
    expect(steps[1]).toMatchObject({ id: 'draft-plan', tool: undefined });
  });

  test('createDeterministicPlan returns apply steps without invalid tool metadata', async () => {
    const repositoryContext = await buildRepositoryContext(process.cwd(), []);
    const steps = await createDeterministicPlan(
      'apply',
      'plan.json',
      repositoryContext,
      stubContext,
    );

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ id: 'validate-plan', tool: undefined });
    expect(steps[1]).toMatchObject({ id: 'execute-plan', tool: undefined });
  });

  test('executePlanSteps transitions step states and returns ok', async () => {
    const repositoryContext = await buildRepositoryContext(process.cwd(), []);
    const steps = await createDeterministicPlan(
      'plan',
      'update README',
      repositoryContext,
      stubContext,
    );
    const registry = createStubRegistry({
      name: 'file-search',
      description: 'stub search',
      execute: async () => ({ query: 'update README', results: [] }),
    });

    const summary = await executePlanSteps(steps, registry, stubContext, noopLogger, 'plan');

    expect(summary.status).toBe('ok');
    expect(summary.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(summary.artifacts).toEqual(
      expect.arrayContaining([expect.stringContaining('analyze-task')]),
    );
  });

  test('executePlanSteps appends a post-validation step for apply commands', async () => {
    const steps = [
      {
        id: 'validate-plan',
        title: 'Validate the supplied plan file',
        description: 'Check the plan structure and contents before execution',
        status: 'planned' as const,
      },
    ];
    const registry = createStubRegistry({
      name: 'run-tests',
      description: 'stub validation',
      execute: async () => ({ command: 'npm test', stdout: 'ok', stderr: '', exitCode: 0 }),
    });

    const summary = await executePlanSteps(steps, registry, stubContext, noopLogger, 'apply');

    expect(summary.steps.some((step) => step.id === 'post-validation')).toBe(true);
    expect(summary.commandsExecuted).toEqual(expect.arrayContaining(['npm test']));
    expect(summary.filesChanged).toBeUndefined();
  });
});
