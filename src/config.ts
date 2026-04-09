import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import type { CliConfig, ApprovalMode } from './types';
import { CliConfigSchema } from './schemas';

type ConfigurationInput = z.input<typeof CliConfigSchema>;

export async function loadConfig(cliOptions: Partial<CliConfig>): Promise<CliConfig> {
  const explorer = cosmiconfig('minicode');
  const searchResult = cliOptions.configPath
    ? await explorer.load(cliOptions.configPath)
    : await explorer.search(cliOptions.cwd ?? process.cwd());
  const fileConfig = (searchResult?.config ?? {}) as ConfigurationInput;

  const parseResult = CliConfigSchema.safeParse({
    ...fileConfig,
    ...cliOptions,
    cwd: cliOptions.cwd ?? fileConfig.cwd ?? process.cwd(),
    ignorePatterns: cliOptions.ignorePatterns ?? fileConfig.ignorePatterns ?? [],
  });

  if (!parseResult.success) {
    const details = parseResult.error.errors
      .map((error) => `${error.path.join('.')}: ${error.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }

  const config = parseResult.data;
  return {
    cwd: config.cwd,
    configPath: cliOptions.configPath ?? fileConfig.configPath,
    dryRun: config.dryRun,
    json: config.json,
    verbose: config.verbose,
    approval: config.approval as ApprovalMode,
    ignorePatterns: config.ignorePatterns ?? [],
  };
}
