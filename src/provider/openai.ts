import type { ProviderAdapter, ModelRequest, RunContext } from '../types';

export const openaiProviderAdapter: ProviderAdapter = {
  name: 'openai',
  description: 'OpenAI-compatible provider adapter',
  async execute(request: ModelRequest, context: RunContext) {
    const openaiCfg = context.config.provider?.openai;
    const baseUrl = openaiCfg?.baseUrl ?? 'https://api.openai.com';
    const apiKey = openaiCfg?.apiKey;

    if (!apiKey) {
      throw new Error('OpenAI API key not configured (OPENAI_API_KEY)');
    }

    const model = (request.metadata as any)?.model ?? 'gpt-3.5-turbo';
    const payload = {
      model,
      messages: [{ role: 'user', content: request.prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    };

    const fetchImpl = (globalThis as any).fetch;
    if (!fetchImpl) {
      throw new Error('Fetch API not available in runtime');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

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
