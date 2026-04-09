import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { stdin as input, stdout as output } from 'node:process';
import { Command, Option } from 'commander';
import { nanoid } from 'nanoid';
import { createLogger } from './logger';
import { loadConfig } from './config';
import { createBuiltinToolRegistry } from './tool-registry';
import { localProviderAdapter } from './provider';
import { buildRepositoryContext } from './context';
import { createDeterministicPlan, executePlanSteps } from './orchestrator';
import { CommandEnvelopeSchema, ResultEnvelopeSchema, PlanStepSchema } from './schemas';
import { MemoryStore, SessionMemory } from './memory';
import type {
  CliConfig,
  PlanStep,
  RunSummary,
  CommandEnvelope,
  ResultEnvelope,
  ProviderAdapter,
  RunContext,
} from './types';

const COMMAND_VERSION = '0.1.0';
const approvalModes = ['auto', 'on-request', 'strict'] as const;

type PartialCliOptions = Partial<CliConfig> & {
  config?: string;
};

function resolveCliOptions(options: PartialCliOptions): Partial<CliConfig> {
  return {
    ...options,
    configPath: options.config ?? options.configPath,
  };
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

  if (summary.commandsExecuted?.length) {
    console.log('Commands executed:');
    summary.commandsExecuted.forEach((command) => {
      console.log(`  - ${command}`);
    });
  }

  if (summary.filesChanged?.length) {
    console.log('Files changed:');
    summary.filesChanged.forEach((filePath) => {
      console.log(`  - ${filePath}`);
    });
  }
}

async function executeCommand(command: string, target?: string, rawOptions?: PartialCliOptions) {
  const config = await loadConfig(resolveCliOptions(rawOptions ?? {}));
  const logger = createLogger(config);
  const toolRegistry = createBuiltinToolRegistry();
  const provider = localProviderAdapter;
  const memoryStore = MemoryStore.open(config.cwd);
  try {
    const repositoryContext = await buildRepositoryContext(config.cwd, config.ignorePatterns ?? []);
    const context: RunContext = {
      runId: nanoid(),
      sessionId: nanoid(),
      startedAt: new Date().toISOString(),
      config,
    };
    const sessionMemory = new SessionMemory(context.runId);
    context.memory = sessionMemory;

    logger.debug(
      { root: repositoryContext.root, fileCount: repositoryContext.files.length },
      'Loaded repository context',
    );

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

    if (command === 'replay') {
      const replayTarget = String(target ?? '');
      const recorded = memoryStore.loadRun(replayTarget);
      if (!recorded) {
        throw new Error(`No recorded run found for id ${replayTarget}`);
      }

      logger.info({ replayTarget }, 'Replaying recorded run');
      renderSummary(recorded.summary, config.json);
      return;
    }

    let steps: PlanStep[] = [];
    let summary: RunSummary;

    if (command === 'apply') {
      const planFilePath = path.resolve(config.cwd, target ?? '');
      const fileContents = await fs.readFile(planFilePath, 'utf8');
      const parsed = JSON.parse(fileContents) as PlanStep[];
      steps = parsed.map((step) => PlanStepSchema.parse(step));
    } else {
      steps = await createDeterministicPlan(command, target, repositoryContext, context);
    }

    const modelRequest = {
      prompt: `Create a plan for command=${command} target=${target ?? 'n/a'}`,
      tools: toolRegistry.list().map((tool) => tool.name),
      metadata: {
        dryRun: config.dryRun,
        approval: config.approval,
        workspaceFileCount: repositoryContext.files.length,
      },
    };

    const providerResponse = await provider.execute(modelRequest, context);
    logger.debug({ providerResponse }, 'Provider generated plan guidance');

    if (command === 'plan' || command === 'run') {
      steps[0].result = {
        summary: providerResponse.text,
        metadata: providerResponse.metadata,
      };
    }

    if (!config.json) {
      logger.info('Completed initial command bootstrap');
    }

    if (command === 'chat') {
      summary = await runChatSession(provider, context, logger);
    } else {
      summary = await executePlanSteps(steps, toolRegistry, context, logger, command);
    }

    const resultEnvelope: ResultEnvelope = {
      runId: context.runId,
      status: summary.status,
      summary,
      completedAt: new Date().toISOString(),
    };
    ResultEnvelopeSchema.parse(resultEnvelope);
    memoryStore.persistRun(commandEnvelope, resultEnvelope, sessionMemory);

    renderSummary(summary, config.json);
  } finally {
    memoryStore.close();
  }
}

async function runChatSession(
  provider: ProviderAdapter,
  context: RunContext,
  logger: ReturnType<typeof createLogger>,
): Promise<RunSummary> {
  const rl = readline.createInterface({ input, output, terminal: true });
  const steps: PlanStep[] = [];
  logger.info('Starting chat session. Type `exit` or `quit` to end.');

  async function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  }

  while (true) {
    const userMessage = await ask('> ');
    const normalized = userMessage.trim();
    if (!normalized || normalized.toLowerCase() === 'exit' || normalized.toLowerCase() === 'quit') {
      break;
    }

    const response = await provider.execute(
      {
        prompt: normalized,
        metadata: { chat: true, dryRun: context.config.dryRun },
      },
      context,
    );

    console.log(response.text);
    steps.push({
      id: `chat-${Date.now()}`,
      title: 'Chat interaction',
      description: 'Interactive chat message exchange with provider',
      status: 'completed',
      result: { userMessage: normalized, response: response.text },
    });
  }

  rl.close();

  return {
    runId: context.runId,
    command: 'chat session',
    status: 'ok',
    steps,
    artifacts: [`chat-messages:${steps.length}`, `startedAt:${context.startedAt}`],
  };
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
    .addOption(new Option('--approval <mode>', 'approval mode').choices(approvalModes));

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
