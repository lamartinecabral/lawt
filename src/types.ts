export type ApprovalMode = 'auto' | 'on-request' | 'strict';

export interface CliConfig {
  cwd: string;
  configPath?: string;
  dryRun: boolean;
  json: boolean;
  verbose: boolean;
  approval: ApprovalMode;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'completed' | 'skipped';
}

export interface RunSummary {
  runId: string;
  command: string;
  status: 'ok' | 'failed';
  steps: PlanStep[];
}

export interface RunContext {
  runId: string;
  sessionId: string;
  startedAt: string;
  config: CliConfig;
}
