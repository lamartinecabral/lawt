import fs from 'fs';
import path from 'path';
import { expect, test } from 'vitest';
import { loadConfig } from '../src/config';
import { createBuiltinToolRegistry } from '../src/tool-registry';
import { localProviderAdapter } from '../src/provider';
import { CommandEnvelopeSchema, RunSummarySchema, ToolCallSchema } from '../src/schemas';

test('loads default cli configuration when no config file exists', async () => {
  const config = await loadConfig({
    cwd: process.cwd(),
    dryRun: false,
    json: false,
    verbose: false,
    approval: 'auto',
  });

  expect(config).toEqual(
    expect.objectContaining({
      cwd: expect.any(String),
      dryRun: false,
      json: false,
      verbose: false,
      approval: 'auto',
    }),
  );
});

test('accepts --config option as configPath during CLI load', async () => {
  const configPath = './.minicode.json';
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  fs.writeFileSync(
    absoluteConfigPath,
    JSON.stringify({ dryRun: true, json: true, verbose: true, approval: 'strict' }),
  );

  try {
    const config = await loadConfig({
      cwd: process.cwd(),
      configPath,
      dryRun: true,
      json: true,
      verbose: true,
      approval: 'strict',
    });

    expect(config.configPath).toBe(configPath);
    expect(config.dryRun).toBe(true);
    expect(config.approval).toBe('strict');
  } finally {
    fs.unlinkSync(absoluteConfigPath);
  }
});

test('builtin tool registry exposes core adapters and validates tool calls', async () => {
  const registry = createBuiltinToolRegistry();
  expect(registry.get('file-read')).toBeDefined();
  expect(registry.get('shell')).toBeDefined();
  expect(registry.get('git')).toBeDefined();

  const toolCall = await registry.execute(
    'git',
    {},
    {
      runId: 'test-run',
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      config: {
        cwd: process.cwd(),
        dryRun: true,
        json: false,
        verbose: false,
        approval: 'auto',
      },
    },
  );

  expect(ToolCallSchema.parse(toolCall)).toMatchObject({
    name: 'git',
    success: true,
  });
});

test('local provider adapter returns a stubbed response', async () => {
  const response = await localProviderAdapter.execute(
    { prompt: 'hello world' },
    {
      runId: 'run-1',
      sessionId: 'session-1',
      startedAt: new Date().toISOString(),
      config: {
        cwd: process.cwd(),
        dryRun: false,
        json: false,
        verbose: false,
        approval: 'auto',
      },
    },
  );

  expect(response).toEqual(
    expect.objectContaining({ text: expect.stringContaining('hello world') }),
  );
});

test('command envelope schema validates CLI command payload', () => {
  const envelope = {
    command: 'plan',
    target: 'update README',
    config: {
      cwd: process.cwd(),
      dryRun: false,
      json: false,
      verbose: false,
      approval: 'auto',
    },
    requestedAt: new Date().toISOString(),
    runId: 'run-2',
    sessionId: 'session-2',
  };

  expect(() => CommandEnvelopeSchema.parse(envelope)).not.toThrow();
});

test('run summary schema accepts valid run metadata', () => {
  const summary = {
    runId: 'run-3',
    command: 'doctor',
    status: 'ok',
    steps: [
      {
        id: 'step-1',
        title: 'Verify environment',
        description: 'Ensure CLI environment is healthy',
        status: 'completed',
      },
    ],
  };

  expect(() => RunSummarySchema.parse(summary)).not.toThrow();
});
