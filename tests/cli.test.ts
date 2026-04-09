import fs from 'fs';
import path from 'path';
import { expect, test, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { runCli } from '../src/cli';
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

test('agent CLI accepts --config and runs plan command with a specified config path', async () => {
  const configPath = './custom-config.json';
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  fs.writeFileSync(
    absoluteConfigPath,
    JSON.stringify({ approval: 'strict', dryRun: true, json: true }),
  );

  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    await expect(
      runCli(['node', 'agent', 'plan', 'update docs', '--config', configPath, '--json']),
    ).resolves.not.toThrow();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    fs.unlinkSync(absoluteConfigPath);
  }
});

test('builtin tool registry exposes core adapters and validates tool calls', async () => {
  const registry = createBuiltinToolRegistry();
  expect(registry.get('file-read')).toBeDefined();
  expect(registry.get('file-search')).toBeDefined();
  expect(registry.get('file-edit')).toBeDefined();
  expect(registry.get('shell')).toBeDefined();
  expect(registry.get('git')).toBeDefined();
  expect(registry.get('run-tests')).toBeDefined();

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

test('buildRepositoryContext scans repository and honors ignore patterns', async () => {
  const { buildRepositoryContext } = await import('../src/context');
  const context = await buildRepositoryContext(process.cwd(), ['tests/fixtures']);

  expect(context.root).toBe(process.cwd());
  expect(context.files).toEqual(expect.any(Array));
  expect(context.files.some((file) => file.relativePath === 'README.md')).toBe(true);
  expect(context.files.every((file) => !file.relativePath.includes('tests/fixtures'))).toBe(true);
});

test('shell tool respects dry-run and rejects dangerous commands', async () => {
  const registry = createBuiltinToolRegistry();

  const safeCall = await registry.execute(
    'shell',
    { command: 'echo hello' },
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

  expect(safeCall.success).toBe(true);
  expect(safeCall.output).toMatchObject({ dryRun: true });

  const dangerousCall = await registry.execute(
    'shell',
    { command: 'rm -rf /' },
    {
      runId: 'test-run',
      sessionId: 'test-session',
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

  expect(dangerousCall.success).toBe(false);
  expect(dangerousCall.error).toContain('Policy denied');
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
