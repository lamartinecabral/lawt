export type ApprovalMode = 'auto' | 'on-request' | 'strict';

export interface CliConfig {
  cwd: string;
  configPath?: string;
  dryRun: boolean;
  json: boolean;
  verbose: boolean;
  approval: ApprovalMode;
  ignorePatterns?: string[];
}

export type PlanStepStatus =
  | 'planned'
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: PlanStepStatus;
  tool?: string;
  inputs?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  startedAt: string;
  endedAt?: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface RunArtifact {
  runId: string;
  goal: string;
  summary: string;
  filesChanged: string[];
  commandsExecuted: string[];
  createdAt: string;
}

export interface RunSummary {
  runId: string;
  command: string;
  status: 'ok' | 'failed';
  steps: PlanStep[];
  artifacts?: string[];
  commandsExecuted?: string[];
  filesChanged?: string[];
}

export interface CommandEnvelope {
  command: string;
  target?: string;
  config: CliConfig;
  requestedAt: string;
  runId: string;
  sessionId: string;
}

export interface ResultEnvelope {
  runId: string;
  status: 'ok' | 'failed';
  summary: RunSummary;
  completedAt: string;
}

export interface PolicyDecision {
  action: 'allow' | 'deny' | 'review';
  reason: string;
  details?: Record<string, unknown>;
}

export interface ModelRequest {
  prompt: string;
  tools?: string[];
  metadata?: Record<string, unknown>;
}

export interface ModelResponse {
  text: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

export interface SessionMemory {
  runId: string;
  createdAt: string;
  storeToolCall(toolCall: ToolCall): void;
  getToolCalls(): ToolCall[];
  set(key: string, value: unknown): void;
  get(key: string): unknown;
}

export interface RunContext {
  runId: string;
  sessionId: string;
  startedAt: string;
  config: CliConfig;
  memory?: SessionMemory;
}

export interface ProviderAdapter {
  name: string;
  description: string;
  execute(request: ModelRequest, context: RunContext): Promise<ModelResponse>;
}

export interface ToolRuntimeContext {
  runContext: RunContext;
}

export interface ToolAdapter {
  name: string;
  description: string;
  execute(args: Record<string, unknown>, context: ToolRuntimeContext): Promise<unknown>;
}

export interface ToolRegistryInterface {
  register(adapter: ToolAdapter): this;
  get(name: string): ToolAdapter | undefined;
  list(): ToolAdapter[];
}

export interface ToolRegistry extends ToolRegistryInterface {
  execute(name: string, args: Record<string, unknown>, context: RunContext): Promise<ToolCall>;
}

export interface PlanningStrategy {
  name: string;
  createPlan(goal: string, context: RunContext): Promise<PlanStep[]>;
}

export interface ExecutionStrategy {
  name: string;
  executePlan(steps: PlanStep[], context: RunContext): Promise<RunSummary>;
}
