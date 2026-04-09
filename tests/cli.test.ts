import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, test, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { runCli } from '../src/cli';
import { createBuiltinToolRegistry } from '../src/tool-registry';
import { localProviderAdapter } from '../src/provider';
import { MemoryStore } from '../src/memory';
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

test('preserves config file values when CLI flags are omitted', async () => {
  const configPath = './.minicode-precedence.json';
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  fs.writeFileSync(
    absoluteConfigPath,
    JSON.stringify({ dryRun: true, json: true, verbose: true, approval: 'strict' }),
  );

  try {
    const config = await loadConfig({
      cwd: process.cwd(),
      configPath,
    });

    expect(config.dryRun).toBe(true);
    expect(config.json).toBe(true);
    expect(config.verbose).toBe(true);
    expect(config.approval).toBe('strict');
  } finally {
    fs.unlinkSync(absoluteConfigPath);
  }
});

test('explicit CLI options override config file values', async () => {
  const configPath = './.minicode-precedence-override.json';
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  fs.writeFileSync(
    absoluteConfigPath,
    JSON.stringify({ dryRun: true, json: true, verbose: true, approval: 'strict' }),
  );

  try {
    const config = await loadConfig({
      cwd: process.cwd(),
      configPath,
      dryRun: false,
      json: false,
      verbose: false,
      approval: 'auto',
    });

    expect(config.dryRun).toBe(false);
    expect(config.json).toBe(false);
    expect(config.verbose).toBe(false);
    expect(config.approval).toBe('auto');
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
  const { buildRepositoryContext } = await import('../src/context.js');
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

test('shell tool requires approval in on-request mode', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
    'shell',
    { command: 'echo hello' },
    {
      runId: 'test-run',
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      config: {
        cwd: process.cwd(),
        dryRun: false,
        json: false,
        verbose: false,
        approval: 'on-request',
      },
    },
  );

  expect(toolCall.success).toBe(false);
  expect(toolCall.error).toContain('requires approval');
  expect(toolCall.error).toContain('on-request');
});

test('shell tool denies review path in strict mode', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
    'shell',
    { command: 'echo hello' },
    {
      runId: 'test-run',
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      config: {
        cwd: process.cwd(),
        dryRun: false,
        json: false,
        verbose: false,
        approval: 'strict',
      },
    },
  );

  expect(toolCall.success).toBe(false);
  expect(toolCall.error).toContain('denied under strict approval mode');
});

test('file-edit tool requires approval in on-request mode', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
    'file-edit',
    { path: './phase7-test.txt', content: 'safe content' },
    {
      runId: 'test-run',
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      config: {
        cwd: process.cwd(),
        dryRun: false,
        json: false,
        verbose: false,
        approval: 'on-request',
      },
    },
  );

  expect(toolCall.success).toBe(false);
  expect(toolCall.error).toContain('requires approval');
});

test('file-edit tool denies review path in strict mode', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
    'file-edit',
    { path: './phase7-test.txt', content: 'safe content' },
    {
      runId: 'test-run',
      sessionId: 'test-session',
      startedAt: new Date().toISOString(),
      config: {
        cwd: process.cwd(),
        dryRun: false,
        json: false,
        verbose: false,
        approval: 'strict',
      },
    },
  );

  expect(toolCall.success).toBe(false);
  expect(toolCall.error).toContain('denied under strict approval mode');
});

test('shell tool auto-approves review path in auto mode', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
    'shell',
    { command: 'echo hello' },
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

  expect(toolCall.success).toBe(true);
  expect(toolCall.output).toMatchObject({ command: 'echo hello', exitCode: 0 });
});

test('shell tool reports non-zero exit code as a failed tool call', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
    'shell',
    { command: 'node -e "process.exit(2)"' },
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

  expect(toolCall.success).toBe(false);
  expect(toolCall.error).toContain('Command failed');
});

test('run-tests tool reports command failures as failed tool calls', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
    'run-tests',
    { command: 'node -e "process.exit(3)"' },
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

  expect(toolCall.success).toBe(false);
  expect(toolCall.error).toContain('Command failed');
});

test('dry-run bypasses review gating for shell commands', async () => {
  const registry = createBuiltinToolRegistry();

  const toolCall = await registry.execute(
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
        approval: 'strict',
      },
    },
  );

  expect(toolCall.success).toBe(true);
  expect(toolCall.output).toMatchObject({ dryRun: true });
});

test('CLI closes memory store after command execution', async () => {
  const closeSpy = vi.spyOn(MemoryStore.prototype, 'close');
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    await expect(
      runCli(['node', 'agent', 'plan', 'validate cleanup', '--dry-run', '--json']),
    ).resolves.not.toThrow();
    expect(closeSpy).toHaveBeenCalled();
  } finally {
    closeSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }
});

test('text summary includes executed command listings when present', async () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    await expect(
      runCli(['node', 'agent', 'run', 'summarize command output', '--dry-run']),
    ).resolves.not.toThrow();

    const combinedOutput = logSpy.mock.calls
      .map((args) => args.map((value) => String(value)).join(' '))
      .join('\n');

    expect(combinedOutput).toContain('Commands executed:');
    expect(combinedOutput).toContain('npm test');
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }
});

test('workspace-boundary denials do not write to console.error', async () => {
  const registry = createBuiltinToolRegistry();
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  try {
    const toolCall = await registry.execute(
      'file-read',
      { path: '../../outside-workspace' },
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

    expect(toolCall.success).toBe(false);
    expect(toolCall.error).toContain('workspace boundary');
    expect(errorSpy).not.toHaveBeenCalled();
  } finally {
    errorSpy.mockRestore();
  }
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

test('doctor command does not invoke provider adapter selection', async () => {
  const providerModule = await import('../src/provider.js');
  const selectSpy = vi.spyOn(providerModule, 'selectProviderAdapter');
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  try {
    await expect(
      runCli(['node', 'agent', 'doctor', '--dry-run', '--json']),
    ).resolves.not.toThrow();
    expect(selectSpy).not.toHaveBeenCalled();
  } finally {
    selectSpy.mockRestore();
    logSpy.mockRestore();
  }
});

test('replay command does not invoke provider adapter selection', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'minicode-replay-'));
  const store = MemoryStore.open(root);
  const requestedAt = new Date().toISOString();
  const completedAt = new Date().toISOString();

  store.persistRun(
    {
      command: 'plan',
      target: 'test replay',
      config: {
        cwd: root,
        dryRun: true,
        json: true,
        verbose: false,
        approval: 'auto',
      },
      requestedAt,
      runId: 'replay-run-id',
      sessionId: 'replay-session-id',
    },
    {
      runId: 'replay-run-id',
      status: 'ok',
      completedAt,
      summary: {
        runId: 'replay-run-id',
        command: 'dry-run:plan',
        status: 'ok',
        steps: [],
      },
    },
  );
  store.close();

  const providerModule = await import('../src/provider.js');
  const selectSpy = vi.spyOn(providerModule, 'selectProviderAdapter');
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  try {
    await expect(
      runCli(['node', 'agent', 'replay', 'replay-run-id', '--json', '--cwd', root]),
    ).resolves.not.toThrow();
    expect(selectSpy).not.toHaveBeenCalled();
  } finally {
    selectSpy.mockRestore();
    logSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('apply command rejects plan paths outside workspace boundary', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'minicode-apply-root-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'minicode-apply-outside-'));
  const outsidePlanPath = path.join(outside, 'plan.json');
  fs.writeFileSync(outsidePlanPath, '[]');
  const relativeOutsidePlanPath = path.relative(root, outsidePlanPath);

  try {
    await expect(
      runCli([
        'node',
        'agent',
        'apply',
        relativeOutsidePlanPath,
        '--json',
        '--dry-run',
        '--cwd',
        root,
      ]),
    ).rejects.toThrow(/outside of the repository workspace/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
