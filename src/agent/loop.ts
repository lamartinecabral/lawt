import type { Ollama } from "ollama";
import type { AgentOptions, RunResult, StepRecord, ToolCallRecord } from "../lib/types.js";
import { getToolByName, toolsToOllamaFormat, ALL_TOOLS } from "../tools/index.js";
import { getLogger } from "../lib/logger.js";
import pc from "picocolors";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

interface RawAssistantToolCall {
  function: {
    name: string;
    arguments: unknown;
  };
}

const MUTATING_TOOLS = new Set([
  "write_file",
  "append_file",
  "replace_in_file",
  "delete_file",
  "move_file",
  "mkdir",
]);

const SYSTEM_PROMPT = `You are minicode, a coding agent that operates on files in the user's workspace.
You have access to file-operation tools. Use them to complete tasks.
Always read files before editing them. Be precise and minimal in your changes.
When you are done with the task, provide a final response summarizing what you did.`;

export async function runAgent(
  client: Ollama,
  task: string,
  opts: AgentOptions,
): Promise<RunResult> {
  const log = getLogger();
  const tools = toolsToOllamaFormat();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];

  const steps: StepRecord[] = [];
  const allToolCalls: ToolCallRecord[] = [];
  const changedFiles = new Set<string>();
  const errors: string[] = [];

  for (let step = 0; step < opts.maxSteps; step++) {
    log.debug("Step %d/%d", step + 1, opts.maxSteps);

    if (opts.verbose && !opts.json) {
      console.log(pc.dim(`\n--- Step ${step + 1}/${opts.maxSteps} ---`));
    }

    const response = await client.chat({
      model: opts.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      })),
      think: opts.think,
      tools,
    });

    const assistantMsg = response.message;
    const rawToolCalls = assistantMsg.tool_calls as RawAssistantToolCall[] | undefined;

    // No tool calls → final answer
    if (!rawToolCalls || rawToolCalls.length === 0) {
      const content = assistantMsg.content ?? "";
      steps.push({ role: "assistant", content });
      messages.push({ role: "assistant", content });
      return {
        finalResponse: content,
        steps,
        toolCalls: allToolCalls,
        changedFiles: [...changedFiles],
        errors,
      };
    }

    // Process tool calls
    const stepToolCalls: ToolCallRecord[] = [];
    const normalizedToolCalls = normalizeToolCallsForMessage(rawToolCalls);
    messages.push({
      role: "assistant",
      content: assistantMsg.content ?? "",
      ...(normalizedToolCalls ? { tool_calls: normalizedToolCalls } : {}),
    });

    for (const toolCall of rawToolCalls) {
      const name = toolCall.function.name;
      const record = await executeToolCall(name, toolCall.function.arguments, opts.cwd);
      const args = record.args;

      if (opts.verbose && !opts.json) {
        console.log(pc.cyan(`  → ${name}(${JSON.stringify(args)})`));
      }

      const result = record.result;

      if (opts.verbose && !opts.json) {
        const status = result.success ? pc.green("✓") : pc.red("✗");
        console.log(`    ${status} ${JSON.stringify(result.data ?? result.error).slice(0, 200)}`);
      }

      if (!result.success && result.error) {
        errors.push(result.error);
      }

      if (result.success && MUTATING_TOOLS.has(name)) {
        const filePath =
          (args.path as string | undefined) ?? (args.from as string | undefined) ?? "unknown";
        changedFiles.add(filePath);
      }
      stepToolCalls.push(record);
      allToolCalls.push(record);
      messages.push({ role: "tool", content: JSON.stringify(result) });
    }

    steps.push({
      role: "assistant",
      content: assistantMsg.content ?? "",
      toolCalls: stepToolCalls,
    });
  }

  // Max steps reached
  const maxStepMsg = `Reached maximum steps (${opts.maxSteps}) without final answer.`;
  errors.push(maxStepMsg);
  return {
    finalResponse: maxStepMsg,
    steps,
    toolCalls: allToolCalls,
    changedFiles: [...changedFiles],
    errors,
  };
}

export interface ChatTurnResult {
  response: string;
  toolCalls: ToolCallRecord[];
  errors: string[];
}

export async function runChatTurn(
  client: Ollama,
  messages: ChatMessage[],
  opts: AgentOptions,
): Promise<ChatTurnResult> {
  const tools = toolsToOllamaFormat();
  const toolCalls: ToolCallRecord[] = [];
  const errors: string[] = [];

  for (let step = 0; step < opts.maxSteps; step++) {
    const response = await client.chat({
      model: opts.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      })),
      think: opts.think,
      tools,
    });

    const assistantMsg = response.message;
    const rawToolCalls = assistantMsg.tool_calls as RawAssistantToolCall[] | undefined;
    const normalizedToolCalls = normalizeToolCallsForMessage(rawToolCalls);

    messages.push({
      role: "assistant",
      content: assistantMsg.content ?? "",
      ...(normalizedToolCalls ? { tool_calls: normalizedToolCalls } : {}),
    });

    if (!rawToolCalls || rawToolCalls.length === 0) {
      return {
        response: assistantMsg.content ?? "",
        toolCalls,
        errors,
      };
    }

    for (const toolCall of rawToolCalls) {
      const record = await executeToolCall(toolCall.function.name, toolCall.function.arguments, opts.cwd);
      toolCalls.push(record);
      if (!record.result.success && record.result.error) {
        errors.push(record.result.error);
      }
      messages.push({ role: "tool", content: JSON.stringify(record.result) });
    }
  }

  const maxStepMsg = `Reached maximum steps (${opts.maxSteps}) while handling this chat message.`;
  errors.push(maxStepMsg);
  return {
    response: maxStepMsg,
    toolCalls,
    errors,
  };
}

export async function* streamChat(
  client: Ollama,
  messages: Array<{ role: string; content: string }>,
  model: string,
  think: AgentOptions["think"],
): AsyncGenerator<string> {
  const response = await client.chat({
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    think,
  });
  for await (const chunk of response) {
    if (chunk.message?.content) {
      yield chunk.message.content;
    }
  }
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export { ALL_TOOLS };

function parseToolArgs(rawArgs: unknown): Record<string, unknown> {
  if (typeof rawArgs === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawArgs) as unknown;
    } catch (err: unknown) {
      throw new Error(
        `Invalid tool arguments JSON: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Tool arguments must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  }

  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    throw new Error("Tool arguments must be an object");
  }

  return rawArgs as Record<string, unknown>;
}

async function executeToolCall(
  name: string,
  rawArgs: unknown,
  sandbox: string,
): Promise<ToolCallRecord> {
  let args: Record<string, unknown> = {};

  try {
    args = parseToolArgs(rawArgs);
  } catch (err: unknown) {
    return {
      name,
      args,
      result: {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const tool = getToolByName(name);
  if (!tool) {
    return {
      name,
      args,
      result: {
        success: false,
        error: `Unknown tool: ${name}`,
      },
    };
  }

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    return {
      name,
      args,
      result: {
        success: false,
        error: `Validation error: ${parsed.error.message}`,
      },
    };
  }

  const result = await tool.execute(parsed.data, sandbox);
  return {
    name,
    args,
    result,
  };
}

function normalizeToolCallsForMessage(
  rawToolCalls: RawAssistantToolCall[] | undefined,
): ChatMessage["tool_calls"] | undefined {
  if (!rawToolCalls || rawToolCalls.length === 0) {
    return undefined;
  }

  return rawToolCalls.map((tc) => {
    let args: Record<string, unknown>;
    try {
      args = parseToolArgs(tc.function.arguments);
    } catch {
      // Preserve the tool call even when args are malformed.
      args = {};
    }

    return {
      function: {
        name: tc.function.name,
        arguments: args,
      },
    };
  });
}
