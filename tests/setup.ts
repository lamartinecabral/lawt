import { vi } from 'vitest';

(globalThis as any).fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
  if (url.includes('openai')) {
    const body = JSON.parse(options.body);
    const content = `Stubbed local provider response for prompt: ${body.messages[0].content}`;
    return {
      ok: true,
      json: async () => ({
        choices: [
          { message: { content } }
        ]
      })
    };
  }
  return { ok: true, json: async () => ({}) };
});
