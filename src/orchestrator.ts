import type { Logger } from 'pino';
import type { PlanStep, RepositoryContext, RunContext, RunSummary, ToolRegistry } from './types';

const MAX_RETRY = 1;

function createStep(
  id: string,
  title: string,
  description: string,
  tool?: string,
  inputs?: Record<string, unknown>,
): PlanStep {
  return {
    id,
    title,
    description,
    status: 'planned',
    tool,
    inputs,
  };
}

export async function createDeterministicPlan(
  command: string,
  goal: string | undefined,
  repositoryContext: RepositoryContext,
  _context: RunContext,
): Promise<PlanStep[]> {
  const normalizedGoal = goal?.trim() || 'repository inspection';
  const fileCount = repositoryContext.files.length;
  const planSteps: PlanStep[] = [];

  if (command === 'plan') {
    planSteps.push(
      createStep(
        'analyze-task',
        'Analyze repository and requested task',
        `Scan repository of ${fileCount} files and analyze the goal: ${normalizedGoal}`,
        'file-search',
        { query: normalizedGoal },
      ),
    );
    planSteps.push(
      createStep(
        'draft-plan',
        'Draft the execution plan',
        'Plan the ordered steps that satisfy the task',
      ),
    );
    return planSteps;
  }

  if (command === 'run') {
    planSteps.push(
      createStep(
        'analyze-task',
        'Analyze repository and requested task',
        `Scan repository of ${fileCount} files and analyze the goal: ${normalizedGoal}`,
        'file-search',
        { query: normalizedGoal },
      ),
    );
    planSteps.push(
      createStep(
        'generate-plan',
        'Generate a deterministic execution plan',
        `Build a deterministic execution plan based on the requested task: ${normalizedGoal}`,
        undefined,
        { summary: `Create a safe, traceable plan from the user goal.` },
      ),
    );
    planSteps.push(
      createStep(
        'inspect-version-control',
        'Inspect repository status with git',
        'Gather repository state before execution',
        'git',
        {},
      ),
    );
    planSteps.push(
      createStep(
        'run-validation',
        'Run repository validation checks',
        'Execute the repository validation command before finalizing the task',
        'run-tests',
        { command: 'npm test' },
      ),
    );
    return planSteps;
  }

  if (command === 'apply') {
    planSteps.push(
      createStep(
        'validate-plan',
        'Validate the supplied plan file',
        'Check the plan structure and contents before execution',
      ),
    );
    planSteps.push(
      createStep(
        'execute-plan',
        'Execute the bound plan steps',
        'Run the loaded plan steps from the provided plan file',
      ),
    );
    return planSteps;
  }

  if (command === 'doctor') {
    planSteps.push(
      createStep(
        'inspect-repository',
        'Inspect the workspace repository',
        'Gather git repository metadata for doctor checks',
        'git',
        {},
      ),
    );
    planSteps.push(
      createStep(
        'run-sanity-checks',
        'Run quick validation checks',
        'Execute a quick validation pass for the workspace',
        'run-tests',
        { command: 'npm test' },
      ),
    );
    return planSteps;
  }

  planSteps.push(
    createStep(
      'default-step',
      `Handle command ${command}`,
      `No deterministic plan exists for command ${command}.`,
    ),
  );
  return planSteps;
}

function summarizePlan(steps: PlanStep[]): string {
  return steps.map((step) => `${step.id}:${step.title}`).join('; ');
}

export async function executePlanSteps(
  steps: PlanStep[],
  toolRegistry: ToolRegistry,
  context: RunContext,
  logger: Logger,
  command: string,
): Promise<RunSummary> {
  let interrupted = false;
  const executedTools: string[] = [];
  const commandsExecuted: string[] = [];
  const filesChanged: string[] = [];

  const signalHandler = () => {
    interrupted = true;
    logger.warn('SIGINT received: interrupting execution loop safely');
  };

  process.on('SIGINT', signalHandler);

  let status: RunSummary['status'] = 'ok';

  try {
    for (const step of steps) {
      if (interrupted) {
        step.status = 'skipped';
        logger.warn(`Skipping step ${step.id} due to interruption`);
        continue;
      }

      step.status = 'in-progress';
      logger.info({ step: step.id, tool: step.tool }, `Starting step: ${step.title}`);

      if (step.tool && step.inputs) {
        let attempt = 0;
        let toolCall;
        while (attempt <= MAX_RETRY) {
          toolCall = await toolRegistry.execute(step.tool, step.inputs, context);
          executedTools.push(step.tool);

          if (toolCall.success) {
            break;
          }

          attempt += 1;
          if (attempt <= MAX_RETRY) {
            logger.warn({ step: step.id, attempt, error: toolCall.error }, 'Retrying failed step');
          }
        }

        step.result = { toolCall: toolCall as unknown };
        if (!(toolCall as any).success) {
          status = 'failed';
          step.status = 'failed';
          logger.error({ step: step.id, error: (toolCall as any).error }, 'Step execution failed');
          break;
        }

        if ((toolCall as any).output && typeof (toolCall as any).output === 'object') {
          const output = (toolCall as any).output;
          if (output.command) {
            commandsExecuted.push(String(output.command));
          }
          if (output.path && output.updated) {
            filesChanged.push(String(output.path));
          }
        }

        step.status = 'completed';
        logger.info({ step: step.id }, 'Completed step successfully');
        continue;
      }

      step.status = 'completed';
      logger.info({ step: step.id }, 'Completed step without tool execution');
    }
  } finally {
    process.off('SIGINT', signalHandler);
  }

  if (interrupted && status === 'ok') {
    status = 'failed';
  }

  const summary: RunSummary = {
    runId: context.runId,
    command: context.config.dryRun ? `dry-run:${command}` : command,
    status,
    steps,
    artifacts: [
      summarizePlan(steps),
      ...commandsExecuted.map((value) => `command:${value}`),
      ...filesChanged.map((value) => `file:${value}`),
    ],
  };

  return summary;
}
