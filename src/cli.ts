import { Command } from 'commander';
import { nanoid } from 'nanoid';
import { createLogger } from './logger';
import { loadConfig } from './config';
import { createBuiltinToolRegistry } from './tool-registry';
import { localProviderAdapter } from './provider';
import { CommandEnvelopeSchema, ResultEnvelopeSchema } from './schemas';
import type {
  CliConfig,
  PlanStep,
  RunSummary,
  CommandEnvelope,
  ResultEnvelope,
  RunContext,
} from './types';

const COMMAND_VERSION = '0.1.0';

type PartialCliOptions = Partial<CliConfig> & {
  config?: string;
};

function mergeConfig(options: PartialCliOptions): CliConfig {
  return {
    cwd: options.cwd ?? process.cwd(),
    configPath: options.config ?? options.configPath,
    dryRun: options.dryRun ?? false,
    json: options.json ?? false,
    verbose: options.verbose ?? false,
    approval: options.approval ?? 'auto',
  };
}

function buildPlan(command: string, target?: string): PlanStep[] {
  const now = Date.now().toString();
  if (command === 'plan') {
    return [
      {
        id: `plan-${now}`,
        title: 'Generate a plan for the requested task',
        description: `Create a high-level plan for: ${target ?? 'n/a'}`,
        status: 'not-started',
      },
    ];
  }

  if (command === 'run') {
    return [
      {
        id: `plan-${now}`,
        title: 'Analyze the task and create an execution plan',
        description: `Analyze and plan: ${target ?? 'n/a'}`,
        status: 'not-started',
      },
      {
        id: `execute-${now}`,
        title: 'Execute the generated plan',
        description: 'Execute the step sequence using tool adapters',
        status: 'planned',
      },
    ];
  }

  return [
    {
      id: `command-${now}`,
      title: `Prepare to run the ${command} command`,
      description: `${command} target: ${target ?? 'n/a'}`,
      status: 'planned',
    },
  ];
}

function renderSummary(summary: RunSummary, jsonOutput: boolean): void {
  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log('Run summary');
  console.log('============');
  console.log(`Run ID: ${summary.runId}`);
  console.log(`Command: ${summary.command}`);
  console.log(`Status: ${summary.status}`);
  console.log('Steps:');
  summary.steps.forEach((step) => {
    console.log(`  - ${step.id}: ${step.title} (${step.status})`);
  });
}

async function executeCommand(command: string, target?: string, rawOptions?: Partial<CliConfig>) {
  const defaultConfig = mergeConfig(rawOptions ?? {});
  const config = await loadConfig(defaultConfig);
  const logger = createLogger(config);
  const toolRegistry = createBuiltinToolRegistry();
  const provider = localProviderAdapter;
  const context: RunContext = {
    runId: nanoid(),
    sessionId: nanoid(),
    startedAt: new Date().toISOString(),
    config,
  };

  const commandEnvelope: CommandEnvelope = {
    command,
    target,
    config,
    requestedAt: new Date().toISOString(),
    runId: context.runId,
    sessionId: context.sessionId,
  };
  CommandEnvelopeSchema.parse(commandEnvelope);

  logger.info(
    { runId: context.runId, command, cwd: config.cwd, dryRun: config.dryRun },
    'Starting command',
  );
  logger.debug({ config }, 'Resolved runtime configuration');
  logger.debug({ tools: toolRegistry.list().map((tool) => tool.name) }, 'Available tools');
  logger.debug({ provider: provider.name }, 'Selected provider adapter');

  const steps = buildPlan(command, target);
  const summary: RunSummary = {
    runId: context.runId,
    command: command === 'chat' ? 'chat session' : command,
    status: 'ok',
    steps,
  };

  const modelRequest = {
    prompt: `Create a plan for command=${command} target=${target ?? 'n/a'}`,
    tools: toolRegistry.list().map((tool) => tool.name),
    metadata: {
      dryRun: config.dryRun,
      approval: config.approval,
    },
  };

  const providerResponse = await provider.execute(modelRequest, context);
  logger.debug({ providerResponse }, 'Provider generated plan guidance');

  if (command === 'plan' || command === 'run') {
    steps[0].result = {
      summary: providerResponse.text,
      metadata: providerResponse.metadata,
    };
    steps[0].status = 'completed';
  }

  if (!config.json) {
    logger.info('Completed initial command bootstrap');
  }

  if (command === 'run' && !config.dryRun) {
    await toolRegistry.execute('git', {}, context);
    if (steps.length > 1) {
      steps[1].status = 'completed';
    }
  }

  const resultEnvelope: ResultEnvelope = {
    runId: context.runId,
    status: summary.status,
    summary,
    completedAt: new Date().toISOString(),
  };
  ResultEnvelopeSchema.parse(resultEnvelope);

  renderSummary(summary, config.json);
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program.name('agent').description('minicode CLI coding agent').version(COMMAND_VERSION);

  program
    .option('--cwd <path>', 'workspace root override')
    .option('--config <path>', 'configuration file path')
    .option('--dry-run', 'prevent side effects')
    .option('--json', 'emit machine-readable JSON output')
    .option('--verbose', 'enable verbose logging')
    .option('--approval <mode>', 'approval mode', 'auto');

  program
    .command('run')
    .argument('<task>', 'task to execute')
    .description('Execute a task with planning and validation')
    .action(async (task) => {
      await executeCommand('run', task, program.opts());
    });

  program
    .command('plan')
    .argument('<task>', 'task to plan')
    .description('Generate a plan for the requested task without applying changes')
    .action(async (task) => {
      await executeCommand('plan', task, program.opts());
    });

  program
    .command('apply')
    .argument('<plan-file>', 'path to a previously generated plan file')
    .description('Apply a saved plan to the repository')
    .action(async (planFile) => {
      await executeCommand('apply', planFile, program.opts());
    });

  program
    .command('doctor')
    .description('Inspect environment and repository health')
    .action(async () => {
      await executeCommand('doctor', undefined, program.opts());
    });

  program
    .command('replay')
    .argument('<run-id>', 'run identifier to replay')
    .description('Replay a previous run from recorded metadata')
    .action(async (runId) => {
      await executeCommand('replay', runId, program.opts());
    });

  program
    .command('chat')
    .description('Start an interactive chat session for iterative coding assistance')
    .action(async () => {
      await executeCommand('chat', undefined, program.opts());
    });

  await program.parseAsync(argv);
}
