import type { Ollama } from "ollama";
import type { AgentOptions, RunResult, StepRecord, ToolCallRecord } from "../lib/types.js";
import { getToolByName, toolsToOllamaFormat, ALL_TOOLS } from "../tools/index.js";
import { getLogger } from "../lib/logger.js";
import pc from "picocolors";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

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
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];

  const steps: StepRecord[] = [];
  const allToolCalls: ToolCallRecord[] = [];
  const changedFiles = new Set<string>();
  const errors: string[] = [];
  const mutatingTools = new Set([
    "write_file",
    "append_file",
    "replace_in_file",
    "delete_file",
    "move_file",
    "mkdir",
  ]);

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

    // No tool calls → final answer
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
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
    messages.push({
      role: "assistant",
      content: assistantMsg.content ?? "",
      tool_calls: assistantMsg.tool_calls.map((tc) => ({
        function: {
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === "string"
              ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
              : (tc.function.arguments as Record<string, unknown>),
        },
      })),
    });

    for (const toolCall of assistantMsg.tool_calls) {
      const name = toolCall.function.name;
      const rawArgs = toolCall.function.arguments;
      const args =
        typeof rawArgs === "string"
          ? (JSON.parse(rawArgs) as Record<string, unknown>)
          : (rawArgs as Record<string, unknown>);

      if (opts.verbose && !opts.json) {
        console.log(pc.cyan(`  → ${name}(${JSON.stringify(args)})`));
      }

      const tool = getToolByName(name);
      if (!tool) {
        const err = `Unknown tool: ${name}`;
        errors.push(err);
        const record: ToolCallRecord = { name, args, result: { success: false, error: err } };
        stepToolCalls.push(record);
        allToolCalls.push(record);
        messages.push({ role: "tool", content: JSON.stringify(record.result) });
        continue;
      }

      // Validate with zod
      const parsed = tool.schema.safeParse(args);
      if (!parsed.success) {
        const err = `Validation error: ${parsed.error.message}`;
        errors.push(err);
        const record: ToolCallRecord = { name, args, result: { success: false, error: err } };
        stepToolCalls.push(record);
        allToolCalls.push(record);
        messages.push({ role: "tool", content: JSON.stringify(record.result) });
        continue;
      }

      const result = await tool.execute(parsed.data, opts.cwd);

      if (opts.verbose && !opts.json) {
        const status = result.success ? pc.green("✓") : pc.red("✗");
        console.log(`    ${status} ${JSON.stringify(result.data ?? result.error).slice(0, 200)}`);
      }

      if (!result.success && result.error) {
        errors.push(result.error);
      }

      if (result.success && mutatingTools.has(name)) {
        const filePath =
          (args.path as string | undefined) ?? (args.from as string | undefined) ?? "unknown";
        changedFiles.add(filePath);
      }

      const record: ToolCallRecord = { name, args, result };
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
