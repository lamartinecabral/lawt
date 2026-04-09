import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import type { CliConfig, ApprovalMode } from './types';

const ConfigurationSchema = z.object({
  cwd: z.string().optional(),
  configPath: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  json: z.boolean().optional().default(false),
  verbose: z.boolean().optional().default(false),
  approval: z.enum(['auto', 'on-request', 'strict']).optional().default('auto'),
});

type ConfigurationInput = z.input<typeof ConfigurationSchema>;

export async function loadConfig(cliOptions: Partial<CliConfig>): Promise<CliConfig> {
  const explorer = cosmiconfig('minicode');
  const searchResult = cliOptions.configPath
    ? await explorer.load(cliOptions.configPath)
    : await explorer.search(cliOptions.cwd ?? process.cwd());
  const fileConfig = (searchResult?.config ?? {}) as ConfigurationInput;

  const parsed = ConfigurationSchema.safeParse({
    ...fileConfig,
    ...cliOptions,
    cwd: cliOptions.cwd ?? fileConfig.cwd ?? process.cwd(),
  });

  if (!parsed.success) {
    const details = parsed.error.errors
      .map((error) => `${error.path.join('.')}: ${error.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${details}`);
  }

  const config = parsed.data;
  return {
    cwd: config.cwd,
    configPath: cliOptions.configPath ?? fileConfig.configPath,
    dryRun: config.dryRun,
    json: config.json,
    verbose: config.verbose,
    approval: config.approval as ApprovalMode,
  };
}
