import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import type { CliConfig, ApprovalMode } from './types';
import { CliConfigSchema } from './schemas';

type ConfigurationInput = z.input<typeof CliConfigSchema>;

export async function loadConfig(cliOptions: Partial<CliConfig>): Promise<CliConfig> {
  // Load environment variables from .env file before resolving config
  dotenv.config();

  const explorer = cosmiconfig('minicode');
  const searchResult = cliOptions.configPath
    ? await explorer.load(cliOptions.configPath)
    : await explorer.search(cliOptions.cwd ?? process.cwd());
  const fileConfig = (searchResult?.config ?? {}) as ConfigurationInput;

  const parseResult = CliConfigSchema.safeParse({
    cwd: cliOptions.cwd ?? fileConfig.cwd ?? process.cwd(),
    configPath: cliOptions.configPath ?? fileConfig.configPath,
    dryRun: cliOptions.dryRun !== undefined ? cliOptions.dryRun : fileConfig.dryRun,
    json: cliOptions.json !== undefined ? cliOptions.json : fileConfig.json,
    verbose: cliOptions.verbose !== undefined ? cliOptions.verbose : fileConfig.verbose,
    approval: cliOptions.approval ?? fileConfig.approval,
    ignorePatterns: cliOptions.ignorePatterns ?? fileConfig.ignorePatterns,
    provider: {
      openai: {
        baseUrl:
          process.env.OPENAI_BASE_URL ?? (fileConfig as any)?.provider?.openai?.baseUrl,
        apiKey: process.env.OPENAI_API_KEY ?? (fileConfig as any)?.provider?.openai?.apiKey,
        model: process.env.OPENAI_MODEL ?? (fileConfig as any)?.provider?.openai?.model,
        timeoutMs: process.env.OPENAI_TIMEOUT_MS ?? (fileConfig as any)?.provider?.openai?.timeoutMs,
        requestsPerMinute: process.env.OPENAI_REQUESTS_PER_MINUTE ?? (fileConfig as any)?.provider?.openai?.requestsPerMinute,
        reasoningEffort: process.env.OPENAI_REASONING_EFFORT ?? (fileConfig as any)?.provider?.openai?.reasoningEffort,
      },
    },
  });

  if (!parseResult.success) {
    const details = parseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }

  const config = parseResult.data;
  return {
    cwd: config.cwd ?? process.cwd(),
    configPath: cliOptions.configPath ?? fileConfig.configPath,
    dryRun: config.dryRun,
    json: config.json,
    verbose: config.verbose,
    approval: config.approval as ApprovalMode,
    ignorePatterns: config.ignorePatterns ?? [],
    provider: config.provider ?? {},
  };
}
