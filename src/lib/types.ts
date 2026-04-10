import type { z } from "zod";

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolDefinition<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>, sandbox: string) => Promise<ToolResult>;
}

export interface StepRecord {
  role: "assistant" | "tool";
  content: string;
  toolCalls?: ToolCallRecord[];
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult;
}

export interface RunResult {
  finalResponse: string;
  steps: StepRecord[];
  toolCalls: ToolCallRecord[];
  changedFiles: string[];
  errors: string[];
}

export interface AgentOptions {
  model: string;
  host: string;
  cwd: string;
  maxSteps: number;
  json: boolean;
  verbose: boolean;
}
