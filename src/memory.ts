import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { CommandEnvelope, ResultEnvelope, ToolCall } from './types';

function collectToolCallsFromSummary(summary: ResultEnvelope): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  for (const step of summary.summary.steps) {
    const maybeToolCall = step.result?.toolCall;
    if (maybeToolCall && typeof maybeToolCall === 'object' && 'name' in maybeToolCall) {
      toolCalls.push(maybeToolCall as ToolCall);
    }
  }
  return toolCalls;
}

export class SessionMemory {
  public readonly runId: string;
  public readonly createdAt: string;
  private toolCalls: ToolCall[] = [];
  private metadata: Record<string, unknown> = {};

  constructor(runId: string) {
    this.runId = runId;
    this.createdAt = new Date().toISOString();
  }

  public storeToolCall(toolCall: ToolCall): void {
    this.toolCalls.push(toolCall);
  }

  public getToolCalls(): ToolCall[] {
    return [...this.toolCalls];
  }

  public set(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  public get(key: string): unknown {
    return this.metadata[key];
  }

  public getState(): Record<string, unknown> {
    return {
      runId: this.runId,
      createdAt: this.createdAt,
      toolCalls: [...this.toolCalls],
      metadata: { ...this.metadata },
    };
  }
}

export class MemoryStore {
  private constructor(private readonly db: Database.Database) {}

  public static open(root: string): MemoryStore {
    const storageDir = path.resolve(root, '.minicode');
    fs.mkdirSync(storageDir, { recursive: true });
    const dbPath = path.join(storageDir, 'runstore.sqlite');
    const db = new Database(dbPath);
    const store = new MemoryStore(db);
    store.initializeSchema();
    return store;
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        target TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        config_json TEXT NOT NULL,
        command_envelope_json TEXT NOT NULL,
        result_envelope_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        artifact TEXT NOT NULL,
        FOREIGN KEY(run_id) REFERENCES runs(run_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        success INTEGER NOT NULL,
        arguments_json TEXT NOT NULL,
        output_json TEXT,
        error TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(run_id) ON DELETE CASCADE
      );
    `);
  }

  public persistRun(
    commandEnvelope: CommandEnvelope,
    resultEnvelope: ResultEnvelope,
    sessionMemory?: SessionMemory,
  ): void {
    const runId = commandEnvelope.runId;
    const command = commandEnvelope.command;
    const target = commandEnvelope.target ?? null;
    const status = resultEnvelope.status;
    const createdAt = commandEnvelope.requestedAt;
    const completedAt = new Date().toISOString();
    const configJson = JSON.stringify(commandEnvelope.config);
    const commandJson = JSON.stringify(commandEnvelope);
    const resultJson = JSON.stringify(resultEnvelope);

    const insertRun = this.db.prepare(
      `INSERT OR REPLACE INTO runs (
        run_id, command, target, status, created_at, completed_at, config_json, command_envelope_json, result_envelope_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    );
    insertRun.run(
      runId,
      command,
      target,
      status,
      createdAt,
      completedAt,
      configJson,
      commandJson,
      resultJson,
    );

    const insertArtifact = this.db.prepare(
      'INSERT INTO artifacts (run_id, artifact) VALUES (?, ?);',
    );
    for (const artifact of resultEnvelope.summary.artifacts ?? []) {
      insertArtifact.run(runId, artifact);
    }

    const insertToolCall = this.db.prepare(
      `INSERT INTO tool_calls (
        run_id, tool_name, started_at, ended_at, success, arguments_json, output_json, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    );

    const toolCalls = sessionMemory?.getToolCalls() ?? collectToolCallsFromSummary(resultEnvelope);
    for (const toolCall of toolCalls) {
      insertToolCall.run(
        runId,
        toolCall.name,
        toolCall.startedAt,
        toolCall.endedAt ?? toolCall.startedAt,
        toolCall.success ? 1 : 0,
        JSON.stringify(toolCall.arguments),
        toolCall.output === undefined ? null : JSON.stringify(toolCall.output),
        toolCall.error ?? null,
      );
    }
  }

  public loadRun(runId: string): ResultEnvelope | null {
    const row = this.db
      .prepare('SELECT result_envelope_json FROM runs WHERE run_id = ?;')
      .get(runId);
    if (!row) {
      return null;
    }

    return JSON.parse(row.result_envelope_json) as ResultEnvelope;
  }

  public close(): void {
    this.db.close();
  }
}
