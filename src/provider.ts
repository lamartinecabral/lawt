import type { ModelRequest, ModelResponse, ProviderAdapter, RunContext } from './types';

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
