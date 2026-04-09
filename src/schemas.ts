import { z } from 'zod';

export const CliConfigSchema = z.object({
  cwd: z.string().optional(),
  configPath: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  json: z.boolean().optional().default(false),
  verbose: z.boolean().optional().default(false),
  approval: z.enum(['auto', 'on-request', 'strict']).optional().default('auto'),
  ignorePatterns: z.array(z.string()).optional().default([]),
});

export const PlanStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['planned', 'not-started', 'in-progress', 'completed', 'failed', 'skipped']),
  tool: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
});

export const ToolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  success: z.boolean(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

export const RunArtifactSchema = z.object({
  runId: z.string(),
  goal: z.string(),
  summary: z.string(),
  filesChanged: z.array(z.string()),
  commandsExecuted: z.array(z.string()),
  createdAt: z.string(),
});

export const RunSummarySchema = z.object({
  runId: z.string(),
  command: z.string(),
  status: z.enum(['ok', 'failed']),
  steps: z.array(PlanStepSchema),
  artifacts: z.array(z.string()).optional(),
});

export const CommandEnvelopeSchema = z.object({
  command: z.string(),
  target: z.string().optional(),
  config: CliConfigSchema,
  requestedAt: z.string(),
  runId: z.string(),
  sessionId: z.string(),
});

export const ResultEnvelopeSchema = z.object({
  runId: z.string(),
  status: z.enum(['ok', 'failed']),
  summary: RunSummarySchema,
  completedAt: z.string(),
});

export const PolicyDecisionSchema = z.object({
  action: z.enum(['allow', 'deny', 'review']),
  reason: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ModelRequestSchema = z.object({
  prompt: z.string(),
  tools: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ModelResponseSchema = z.object({
  text: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
