import { describe, expect, test } from 'vitest';
import { createDeterministicPlan, executePlanSteps } from '../src/orchestrator';
import { buildRepositoryContext } from '../src/context';
import type { RunContext, ToolAdapter, ToolRegistry } from '../src/types';
import type { Logger } from 'pino';

const noopLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as unknown as Logger;

const stubContext: RunContext = {
  runId: 'performance-test',
  sessionId: 'performance-session',
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

const createStubRegistry = (adapter: ToolAdapter): ToolRegistry => ({
  register: () => null as any,
  get: () => adapter,
  list: () => [adapter],
  execute: async (name: string, args: Record<string, unknown>) => ({
    name,
    arguments: args,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    success: true,
    output: { command: String(args.command ?? ''), exitCode: 0 },
  }),
} as unknown as ToolRegistry);

describe('performance', () => {
  test('median orchestrator execution latency remains under 500ms', async () => {
    const repositoryContext = await buildRepositoryContext(process.cwd(), []);
    const adapter: ToolAdapter = {
      name: 'file-search',
      description: 'stub search',
      execute: async () => ({ query: 'test', results: [] }),
    };
    const registry = createStubRegistry(adapter);

    const measurements: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const steps = await createDeterministicPlan('plan', 'measure startup', repositoryContext, stubContext);
      const start = performance.now();
      await executePlanSteps(steps, registry, stubContext, noopLogger, 'plan');
      measurements.push(performance.now() - start);
    }

    measurements.sort((a, b) => a - b);
    const median = measurements[Math.floor(measurements.length / 2)];
    expect(median).toBeLessThan(500);
  });
});
