import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { runCli } from '../src/cli';
import type { RunSummary } from '../src/types';

const execFileAsync = promisify(execFile);
let tempDirs: string[] = [];

async function createTempGitRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'minicode-integration-'));
  tempDirs.push(root);
  await fs.writeFile(path.join(root, 'README.md'), '# integration fixture\n');
  await fs.writeFile(path.join(root, 'sample.js'), 'console.log("integration fixture");\n');
  await execFileAsync('git', ['init'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: root });
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: root });
  return root;
}

function normalizeDynamicFields(value: unknown, key?: string): unknown {
  if (typeof value === 'string' && key) {
    if (key === 'runId' || key === 'sessionId') {
      return `<${key}>`;
    }
    if (key.endsWith('At')) {
      return `<${key}>`;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDynamicFields(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        normalizeDynamicFields(childValue, childKey),
      ]),
    );
  }

  return value;
}

function normalizeSummary(summary: RunSummary): unknown {
  return normalizeDynamicFields(summary);
}

async function collectJsonSummary(argv: string[]): Promise<RunSummary> {
  const logs: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.join(' '));
  });

  try {
    await runCli(argv);
  } finally {
    logSpy.mockRestore();
  }

  const output = logs.join('\n');
  return JSON.parse(output) as RunSummary;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe('integration tests', () => {
  test('agent plan returns a valid summary against a git fixture', async () => {
    const fixture = await createTempGitRepo();
    const summary = await collectJsonSummary([
      'node',
      'agent',
      'plan',
      'update docs',
      '--dry-run',
      '--json',
      '--cwd',
      fixture,
    ]);

    expect(summary.command).toBe('dry-run:plan');
    expect(summary.status).toBe('ok');
    expect(summary.steps).toHaveLength(2);
    expect(normalizeSummary(summary)).toMatchSnapshot();
  });

  test('agent doctor produces a healthy diagnostic summary', async () => {
    const fixture = await createTempGitRepo();
    const summary = await collectJsonSummary([
      'node',
      'agent',
      'doctor',
      '--dry-run',
      '--json',
      '--cwd',
      fixture,
    ]);

    expect(summary.command).toBe('dry-run:doctor');
    expect(summary.status).toBe('ok');
    expect(summary.steps.some((step) => step.id === 'inspect-repository')).toBe(true);
    expect(normalizeSummary(summary)).toMatchSnapshot();
  });

  test('agent run persists metadata and agent replay returns the same recorded summary', async () => {
    const fixture = await createTempGitRepo();
    const runSummary = await collectJsonSummary([
      'node',
      'agent',
      'run',
      'fix sample output',
      '--dry-run',
      '--json',
      '--cwd',
      fixture,
    ]);

    expect(runSummary.command).toBe('dry-run:run');
    expect(runSummary.status).toBe('ok');
    expect(runSummary.runId).toBeDefined();

    const replaySummary = await collectJsonSummary([
      'node',
      'agent',
      'replay',
      runSummary.runId,
      '--json',
      '--cwd',
      fixture,
    ]);

    expect(normalizeSummary(replaySummary)).toEqual(normalizeSummary(runSummary));
  });
});
