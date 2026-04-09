import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openaiCompatibleProviderAdapter } from '../src/provider/openai';
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

describe('OpenAI-compatible provider adapter', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = (globalThis as any).fetch;
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws when API key not configured', async () => {
    const ctx = {
      ...baseContext,
      config: {
        ...baseConfig,
        provider: { openai: { baseUrl: 'https://api.openai.com' } },
      },
    } as RunContext;
    await expect(openaiCompatibleProviderAdapter.execute({ prompt: 'hi' }, ctx)).rejects.toThrow(
      /OPENAI_API_KEY is required/
    );
  });

  it('throws when base URL not configured', async () => {
    const ctx = {
      ...baseContext,
      config: {
        ...baseConfig,
        provider: { openai: { apiKey: 'sk-test' } },
      },
    } as RunContext;
    await expect(openaiCompatibleProviderAdapter.execute({ prompt: 'hi' }, ctx)).rejects.toThrow(
      /OPENAI_BASE_URL is required/
    );
  });

  it('maps chat completion choices to ModelResponse.text', async () => {
    const mockResp = { choices: [{ message: { content: 'Hello from model' } }] };
    const fetchSpy = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      json: async () => mockResp,
    }));

    (globalThis as any).fetch = fetchSpy;

    const ctx = {
      ...baseContext,
      config: {
        ...baseConfig,
        provider: { openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' } },
      },
    } as RunContext;

    const res = await openaiCompatibleProviderAdapter.execute({ prompt: 'say hi' }, ctx);
    const requestedUrl = fetchSpy.mock.calls[0]?.[0];

    expect(res.text).toContain('Hello from model');
    expect(res.metadata?.provider).toBe('openai-compatible');
    expect(res.metadata?.model).toBeDefined();
    expect(requestedUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect(res.metadata).not.toHaveProperty('raw');
  });

  it('uses /v1/chat/completions when baseUrl omits /v1', async () => {
    const fetchSpy = vi.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    }));

    (globalThis as any).fetch = fetchSpy;

    const ctx = {
      ...baseContext,
      config: {
        ...baseConfig,
        provider: { openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.com' } },
      },
    } as RunContext;

    await openaiCompatibleProviderAdapter.execute({ prompt: 'say hi' }, ctx);
    const requestedUrl = fetchSpy.mock.calls[0]?.[0];

    expect(requestedUrl).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('selectProviderAdapter returns openai-compatible adapter when apiKey and baseUrl present', () => {
    const cfg = { ...baseConfig, provider: { openai: { apiKey: 'sk-abc', baseUrl: 'https://api.openai.com' } } } as CliConfig;
    const adapter = selectProviderAdapter(cfg);
    expect(adapter.name).toBe('openai-compatible');
  });

  it('selectProviderAdapter throws when no apiKey or baseUrl is present', () => {
    const cfg = { ...baseConfig, provider: {} } as CliConfig;
    expect(() => selectProviderAdapter(cfg)).toThrowError(/OPENAI_API_KEY is required/);
  });
});
