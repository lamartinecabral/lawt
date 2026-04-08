# Node.js CLI Coding Agent Specification

## 1. Overview

### 1.1 Purpose

Build a local-first CLI coding agent in Node.js that can inspect repositories, plan tasks, edit code, run commands, validate changes, and summarize results.

### 1.2 Scope

This specification defines the product behavior, architecture, interfaces, and tooling for the CLI agent.

Model runtime and model-serving setup are intentionally out of scope and must be handled by the user.

### 1.3 Success Criteria

- Agent can complete common coding tasks end-to-end from the terminal.
- Agent produces deterministic, reviewable file edits.
- Agent can run tests/lint and report outcomes clearly.
- Agent can operate safely in non-trusted repositories.

## 2. Goals and Non-Goals

### 2.1 Goals

- Provide an interactive and scriptable CLI agent experience.
- Support tool-augmented reasoning for codebase tasks.
- Keep local workflow fast, reproducible, and transparent.
- Minimize accidental destructive operations.

### 2.2 Non-Goals

- Hosting, provisioning, or configuring local model servers.
- Building a full IDE extension in this phase.
- Replacing CI/CD systems.

## 3. Primary Use Cases

- Create or modify a feature from a prompt.
- Refactor selected files with validation.
- Investigate failing tests and propose fixes.
- Generate or update documentation from code changes.
- Perform codebase search and summarize findings.

## 4. Functional Requirements

### 4.1 Core Agent Capabilities

- Accept user goals and constraints from CLI arguments and interactive prompts.
- Build and maintain a task plan with statuses.
- Read files, search code, and gather repository context.
- Apply targeted edits with minimal diffs.
- Run shell commands and capture stdout/stderr/exit codes.
- Execute validation loops (lint/test/build) after edits.
- Provide final summary of actions and outcomes.

### 4.2 Safety and Control

- Require confirmation for destructive operations.
- Restrict file edits to workspace boundaries.
- Restrict shell commands with policy checks.
- Keep an operation log for reproducibility.
- Support dry-run mode for planning and previewing edits.

### 4.3 State and Memory

- Maintain short-lived session memory (context, plan, tool outputs).
- Persist optional run artifacts for replay/debugging.
- Allow user-defined ignore patterns for indexing and edits.

### 4.4 Extensibility

- Pluggable tool registry (search, edit, shell, git, tests).
- Pluggable model provider adapter (user-supplied runtime).
- Strategy hooks for planning and execution policies.

## 5. Non-Functional Requirements

- Startup time under 1.5 seconds on a typical laptop.
- Median tool call overhead under 200 ms excluding command runtime.
- Clear, structured logs for each run.
- Graceful interruption handling (SIGINT) with cleanup.
- Works on macOS/Linux initially, Windows support next phase.

## 6. CLI Specification

### 6.1 Commands

- `agent chat`
  - Interactive session for iterative coding assistance.
- `agent run "<task>"`
  - One-shot task execution.
- `agent plan "<task>"`
  - Produces a plan without edits.
- `agent apply <plan-file>`
  - Executes a previously generated plan.
- `agent doctor`
  - Environment and dependency diagnostics.
- `agent replay <run-id>`
  - Replays prior run metadata and outputs.

### 6.2 Global Flags

- `--cwd <path>` workspace root override
- `--config <path>` configuration file override
- `--dry-run` prevent writes and command execution side effects
- `--json` machine-readable output
- `--verbose` expanded logs
- `--approval <auto|on-request|strict>` safety policy level

## 7. Architecture

### 7.1 High-Level Components

- CLI Layer: argument parsing, interactive prompts, output rendering.
- Orchestrator: plan generation, execution loop, retry logic.
- Context Engine: repository scan, file retrieval, compression.
- Tool Runtime: search/edit/shell/git tool adapters and policy checks.
- Memory Store: session state, artifacts, run logs.
- Provider Adapter: interface to user-configured local model runtime.

### 7.2 Execution Flow

1. Parse command and load config.
2. Build initial context (repo metadata, relevant files).
3. Create plan from user goal.
4. Execute plan steps via tool runtime.
5. Validate changes with lint/test/build hooks.
6. Summarize edits, commands, and final status.

## 8. Recommended Tools and Libraries

The list below is the recommended stack for this project goal.

### 8.1 Runtime and Language

- Node.js 22 LTS
- TypeScript 5.x

### 8.2 CLI UX

- `commander` for command/flag parsing
- `enquirer` for interactive terminal prompts
- `chalk` for readable colored output
- `ora` for progress indicators
- `cli-table3` for tabular summaries

### 8.3 File System and Search

- `fast-glob` for cross-platform file discovery
- `ignore` for gitignore-compatible filtering
- `chokidar` for optional watch mode
- `ripgrep` (system dependency) for fast content search

### 8.4 Process and Shell Execution

- `execa` for robust subprocess handling
- `shell-quote` for command parsing/escaping safeguards

### 8.5 Code Parsing and Transformations

- `tree-sitter` for language-aware parsing
- `recast` for AST-based safe rewrites
- `ts-morph` for TypeScript-specific refactors
- `diff` for unified patch generation

### 8.6 Validation and Configuration

- `zod` for runtime schema validation
- `cosmiconfig` for layered config loading
- `dotenv` for environment loading

### 8.7 Logging and Observability

- `pino` for structured logs
- `pino-pretty` for local readable output
- `nanoid` for run/session identifiers

### 8.8 Persistence

- `better-sqlite3` for local run metadata and artifacts
- `keyv` as lightweight key-value abstraction (optional)

### 8.9 Testing and Quality

- `vitest` for unit/integration tests
- `c8` for coverage
- `eslint` + `@typescript-eslint/*` for linting
- `prettier` for formatting
- `lint-staged` + `husky` for pre-commit checks

### 8.10 Build and Packaging

- `tsup` for fast TypeScript builds
- `npm` or `pnpm` workspaces (if monorepo expansion needed)

### 8.11 Recommended External Developer Tools

- `git` for diff/history operations
- `ripgrep` (`rg`) for content search
- `fd` for fast file discovery (optional)
- `jq` for JSON filtering in automation workflows (optional)

## 9. Project Structure (Proposed)

```text
src/
  cli/
    commands/
    output/
  core/
    orchestrator/
    planner/
    executor/
  context/
    indexer/
    retriever/
  tools/
    file/
    search/
    shell/
    git/
  provider/
    adapter/
  memory/
  config/
  types/
tests/
docs/
```

## 10. Data Contracts (Minimum)

### 10.1 Plan Step

- `id: string`
- `title: string`
- `status: "not-started" | "in-progress" | "completed" | "failed"`
- `tool?: string`
- `inputs?: Record<string, unknown>`
- `result?: Record<string, unknown>`

### 10.2 Tool Call

- `name: string`
- `arguments: Record<string, unknown>`
- `startedAt: string`
- `endedAt?: string`
- `success: boolean`
- `output?: string`

### 10.3 Run Artifact

- `runId: string`
- `goal: string`
- `summary: string`
- `filesChanged: string[]`
- `commandsExecuted: string[]`
- `createdAt: string`

## 11. Security and Guardrails

- Enforce workspace path sandbox for all file operations.
- Block high-risk shell patterns by default.
- Require explicit user approval for delete/reset operations.
- Redact sensitive environment values in logs.
- Add command timeout and process kill controls.

## 12. Testing Strategy

- Unit tests for parser, planner, tool adapters, and policy checks.
- Integration tests for full run loop on fixture repositories.
- Snapshot tests for CLI output in text and JSON mode.
- Regression tests for known failure scenarios.

## 13. Milestones

### M1: Foundation

- CLI scaffolding, config loading, logging, tool registry.

### M2: Core Agent Loop

- Planning, execution, file edits, and command runner.

### M3: Validation and Safety

- Guardrails, approvals, lint/test hooks, dry-run mode.

### M4: Quality and Release

- Full test suite, docs, packaging, and release automation.

## 14. Acceptance Criteria

- Can complete at least 3 representative coding tasks on a sample repo.
- All modified files are tracked and summarized at end of run.
- Dry-run mode produces no file or process side effects.
- `agent doctor` reports actionable diagnostics.
- Test coverage for core modules is at least 80%.
