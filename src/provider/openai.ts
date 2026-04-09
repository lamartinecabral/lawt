import type { ProviderAdapter, ModelRequest, RunContext } from '../types';

export const openaiProviderAdapter: ProviderAdapter = {
  name: 'openai',
  description: 'OpenAI-compatible provider adapter',
  async execute(request: ModelRequest, context: RunContext) {
    const openaiCfg = context.config.provider?.openai;
    const baseUrl = openaiCfg?.baseUrl ?? 'https://api.openai.com';
    const apiKey = openaiCfg?.apiKey;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    const model = (request.metadata as any)?.model ?? openaiCfg?.model ?? 'gpt-4o-mini';
    const timeoutMs = openaiCfg?.timeoutMs ?? 60000;
    const reasoningEffort = openaiCfg?.reasoningEffort ?? 'medium';

    const payload: any = {
      model,
      messages: [{ role: 'user', content: request.prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    };

    if (reasoningEffort && reasoningEffort !== 'none' && reasoningEffort !== 'default') {
      payload.reasoning_effort = reasoningEffort;
    }

    const fetchImpl = (globalThis as any).fetch;
    if (!fetchImpl) {
      throw new Error('Fetch API not available in runtime');
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new Error(`OpenAI API request timed out after ${timeoutMs}ms`);
      }
      throw new Error(`OpenAI API network error: ${e.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`Invalid JSON response from OpenAI: ${String(e)}`);
    }

    if (!res.ok) {
      const errMsg = json?.error?.message ?? JSON.stringify(json);
      throw new Error(`OpenAI API error: ${errMsg}`);
    }

    // Prefer chat completions shape, fall back to Responses API style
    let text = '';
    if (Array.isArray(json.choices) && json.choices.length) {
      text = json.choices
        .map((c: any) => {
          if (c.message && (c.message.content || c.message.role)) return String(c.message.content ?? '');
          if (c.text) return String(c.text);
          return '';
        })
        .join('\n\n');
    } else if (Array.isArray(json.output) && json.output.length) {
      text = json.output
        .map((o: any) => {
          if (typeof o === 'string') return o;
          if (o.content) {
            if (typeof o.content === 'string') return o.content;
            if (Array.isArray(o.content)) return o.content.map((c: any) => (c.text ? c.text : '')).join('');
          }
          return '';
        })
        .join('\n\n');
    } else if (typeof json.text === 'string') {
      text = json.text;
    }

    const response = {
      text: text ?? '',
      metadata: {
        provider: 'openai',
        model,
        raw: json,
      },
    };

    return response;
  },
};
