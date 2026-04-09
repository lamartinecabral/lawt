import { expect, test } from 'vitest';
import { loadConfig } from '../src/config';
import { createBuiltinToolRegistry } from '../src/tool-registry';

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

test('builtin tool registry exposes core adapters', () => {
  const registry = createBuiltinToolRegistry();
  expect(registry.get('file-read')).toBeDefined();
  expect(registry.get('shell')).toBeDefined();
  expect(registry.get('git')).toBeDefined();
});
