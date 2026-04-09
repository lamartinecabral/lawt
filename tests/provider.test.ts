import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openaiProviderAdapter } from '../src/provider/openai';
import { selectProviderAdapter } from '../src/provider';
import type { CliConfig, RunContext } from '../src/types';

const baseConfig: CliConfig = {
  cwd: process.cwd(),
  dryRun: false,
  json: false,
  verbose: false,
  approval: 'auto',
  ignorePatterns: [],
  provider: {},
};

const baseContext: RunContext = {
  runId: 'test-run',
  sessionId: 'session-1',
  startedAt: new Date().toISOString(),
  config: baseConfig,
  memory: undefined as unknown as any,
};

describe('OpenAI provider adapter', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = (globalThis as any).fetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws when API key not configured', async () => {
    const ctx = { ...baseContext, config: { ...baseConfig, provider: { openai: {} } } } as RunContext;
    await expect(openaiProviderAdapter.execute({ prompt: 'hi' }, ctx)).rejects.toThrow(
      /OpenAI API key not configured/
    );
  });

  it('maps chat completion choices to ModelResponse.text', async () => {
    const mockResp = { choices: [{ message: { content: 'Hello from model' } }] };

    (globalThis as any).fetch = vi.fn(async () => ({
      ok: true,
      json: async () => mockResp,
    }));

    const ctx = {
      ...baseContext,
      config: { ...baseConfig, provider: { openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.com' } } },
    } as RunContext;

    const res = await openaiProviderAdapter.execute({ prompt: 'say hi' }, ctx);
    expect(res.text).toContain('Hello from model');
    expect(res.metadata?.provider).toBe('openai');
    expect(res.metadata?.model).toBeDefined();
  });

  it('selectProviderAdapter returns openai when apiKey present', () => {
    const cfg = { ...baseConfig, provider: { openai: { apiKey: 'sk-abc' } } } as CliConfig;
    const adapter = selectProviderAdapter(cfg);
    expect(adapter.name).toBe('openai');
  });

  it('selectProviderAdapter returns local fallback when no apiKey', () => {
    const cfg = { ...baseConfig, provider: {} } as CliConfig;
    const adapter = selectProviderAdapter(cfg);
    expect(adapter.name).toBe('local-model');
  });
});
