import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';
import { MemoryStore, SessionMemory } from '../src/memory';
import type { CommandEnvelope, ResultEnvelope, RunSummary } from '../src/types';

let tempDir: string | null = null;

async function createTempDir(): Promise<string> {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minicode-memory-'));
  return tempDir;
}

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('MemoryStore', () => {
  test('persists and reloads a recorded run summary', async () => {
    const root = await createTempDir();
    const store = MemoryStore.open(root);

    const commandEnvelope: CommandEnvelope = {
      command: 'run',
      target: 'update docs',
      config: {
        cwd: root,
        dryRun: true,
        json: false,
        verbose: false,
        approval: 'auto',
        ignorePatterns: [],
      },
      requestedAt: new Date().toISOString(),
      runId: 'run-test-1',
      sessionId: 'session-test-1',
    };

    const summary: RunSummary = {
      runId: 'run-test-1',
      command: 'run',
      status: 'ok',
      steps: [
        {
          id: 'step-1',
          title: 'Inspect repository',
          description: 'Verify workspace status',
          status: 'completed',
          tool: 'git',
          inputs: {},
          result: { output: 'OK' },
        },
      ],
      artifacts: ['file:README.md'],
    };

    const resultEnvelope: ResultEnvelope = {
      runId: 'run-test-1',
      status: 'ok',
      summary,
      completedAt: new Date().toISOString(),
    };

    const sessionMemory = new SessionMemory(commandEnvelope.runId);
    sessionMemory.storeToolCall({
      name: 'git',
      arguments: {},
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      success: true,
      output: { status: 'clean' },
    });

    store.persistRun(commandEnvelope, resultEnvelope, sessionMemory);
    store.close();

    const reload = MemoryStore.open(root);
    const loaded = reload.loadRun('run-test-1');
    expect(loaded).toEqual(resultEnvelope);
    reload.close();
  });
});
