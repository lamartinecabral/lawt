import type { ModelRequest, ModelResponse, ProviderAdapter, RunContext, CliConfig } from './types';
import { openaiProviderAdapter } from './provider/openai';

export const localProviderAdapter: ProviderAdapter = {
  name: 'local-model',
  description: 'Primary local model provider adapter placeholder for MVP',
  async execute(request: ModelRequest, context: RunContext): Promise<ModelResponse> {
    return {
      text: `Stubbed local provider response for prompt: ${request.prompt}`,
      metadata: {
        provider: 'local-model',
        dryRun: context.config.dryRun,
      },
    };
  },
};

export function selectProviderAdapter(config: CliConfig): ProviderAdapter {
  if (config.provider?.openai?.apiKey && config.provider?.openai?.baseUrl) {
    return openaiProviderAdapter;
  }
  // The plan indicates that the OpenAI-compatible provider should replace the stub behavior
  // if env vars are present, but if we want to fail fast when using the CLI without required env vars,
  // we could throw here. Let's throw if they are missing since it replaces the stub.
  if (!config.provider?.openai?.apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  if (!config.provider?.openai?.baseUrl) {
    throw new Error('OPENAI_BASE_URL is required');
  }
  return openaiProviderAdapter;
}
