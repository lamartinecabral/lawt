## Plan: Build Minicode CLI Agent From Spec

Build a local-first Node.js CLI coding agent in phased increments that deliver an end-to-end run path early (`agent run` and `agent plan`), then harden with safety controls, persistence, and test coverage to meet the acceptance criteria in the specification. The approach starts from the current minimal scaffold and evolves modular components aligned to the specification’s architecture: CLI layer, orchestrator, context engine, tool runtime, memory store, and provider adapter.

**Steps**

1. Phase 1: Bootstrap project foundation.
   - Update package scripts and dependency layout for TypeScript 5.x build/test/lint workflow targeting Node.js 22 LTS.
   - Replace the current hello-world entry flow with a `agent` CLI entrypoint and command router supporting subcommands.
   - Add baseline config loading, structured logging, run/session id generation, and global flags from the spec: `--cwd`, `--config`, `--dry-run`, `--json`, `--verbose`, and `--approval`.
   - Start lightweight tool registry scaffolding to align Phase 1 with M1 and enable early tool adapter design.
   - Establish a minimal repository fixture so CLI, planner, and validation behavior can be exercised from the first vertical slice.
   - Output: runnable CLI shell with command parsing, global flags, config loading, and a stable entrypoint.
2. Phase 2: Define contracts and core module boundaries. Depends on Step 1.
   - Implement shared types for Plan Step, Tool Call, Run Artifact, command/result envelopes, and policy decisions.
   - Add zod schemas for external inputs, config files, and runtime validation.
   - Define provider adapter interfaces for a user-configured local model runtime and tool adapter interfaces for pluggable execution.
   - Define strategy hook interfaces for planning and execution policy extension to preserve extensibility.
   - Select a primary provider adapter strategy for the MVP so implementation remains focused rather than split across multiple model runtimes.
   - Output: stable internal contracts and validated schema boundaries that all modules compile against.
3. Phase 3: Implement context engine and tool runtime. Depends on Step 2.
   - Build repository index/discovery with user-configurable ignore-pattern handling, workspace boundary enforcement, and relevant file context extraction.
   - Implement a tool registry with at least file read/search/edit, shell, git, and test adapters, matching the spec’s tool runtime goals.
   - Add policy preflight for tool calls, including workspace sandboxing, destructive operation checks, shell restriction policies, timeout defaults, and process kill controls.
   - Output: policy-aware tool execution primitives usable by the orchestrator.
4. Phase 4: Implement orchestrator planning and execution loop. Depends on Step 3.
   - Add plan creation pipeline from user goal, repo context, and deterministic template-driven planning for the first release.
   - Execute ordered plan steps with status transitions, progress tracking, retry/error semantics, and SIGINT interrupt handling.
   - Add dry-run strategy that records intended actions without file/process side effects, and validate it as the safety perimeter before `apply` is enabled.
   - Output: deterministic run loop that can produce plans, execute them, and preserve operation logs and audit trails for reproducibility.
5. Phase 5: Implement CLI commands end to end. Depends on Step 4.
   - Deliver `agent run` and `agent plan` as the first vertical slices.
   - Add `agent apply` for plan-file execution and `agent doctor` for dependency and environment diagnostics.
   - Add `agent chat` as an interactive session for iterative coding assistance using the same core orchestrator and provider primitives.
   - Output: implemented command surface for `run`, `plan`, `apply`, `doctor`, and `chat` with consistent text and JSON output modes.
6. Phase 6: Add memory store and artifact persistence. Depends on Step 4, parallel with Step 5 after contracts are stable.
   - Maintain short-lived session memory for plan context, tool outputs, execution state, and operation logs.
   - Persist run metadata, tool calls, summaries, artifacts, and changed-file manifests for replay/debugging.
   - Implement SQLite-only artifact storage for local run metadata and artifacts, consistent with the specification.
   - Implement `agent replay` once persistence paths are available, and verify end-to-end replay output fidelity.
   - Prioritize the core persistence paths needed by `apply` and `replay` so command flow can be verified early.
   - Verify dry-run behavior end to end: no file writes, no side-effecting commands, and correct planned-only output.
   - Store replay artifacts and ensure correlation by run id so `agent replay` can play back prior run metadata and outputs.
   - Add log redaction for sensitive environment keys/values.
   - Output: reproducible runs and debuggable artifacts aligned with replay command behavior.
7. Phase 7: Safety and approval hardening. Depends on Steps 5 and 6.
   - Implement approval levels `auto`, `on-request`, and `strict` across risky operations.
   - Define risky operations as source modifications, shell execution outside audit flow, destructive file system changes, or sandbox boundary crossing.
   - Enforce destructive action confirmation, guarded delete/reset behavior, and explicit user messaging for symlink or binary-file handling.
   - Output: guardrails required for operation in non-trusted repositories.
8. Phase 8: Validation loop and change summary quality. Depends on Step 5.
   - Run lint/test/build hooks after edits with clear pass/fail reporting.
   - Generate deterministic final summaries that include files changed, commands executed, outcomes, and status.
   - Add minimal-diff editing strategy and optional revert helper behavior.
   - Output: reviewable change reports and robust validation results.
9. Phase 9: Testing and performance verification. Depends on Steps 7 and 8.
   - Add unit tests for parser, planner, tool adapters, policy checks, and CLI command handling.
   - Add integration fixtures for at least three representative coding tasks.
   - Add snapshot tests for CLI text/JSON outputs.
   - Add regression tests for known failure scenarios to satisfy the spec.
   - Measure startup and median tool-call overhead against specification budgets.
   - Output: acceptance evidence including coverage and performance thresholds.
10. Phase 10: Documentation and release readiness. Depends on Step 9.
   - Update user documentation for setup, command behavior, safety model, and troubleshooting.
   - Finalize packaging and release automation.
   - Output: ship-ready CLI with documented operating model.

**Relevant files**

- /Users/lamart/Workspace/minicode/docs/specification.md — authoritative behavior, architecture, milestones, acceptance criteria, and NFR budgets.
- /Users/lamart/Workspace/minicode/package.json — transition from minimal scaffold scripts to build/test/lint/release scripts and dependency graph.
- /Users/lamart/Workspace/minicode/index.js — replace with CLI bootstrap compatibility layer or handoff entrypoint to TypeScript build output.
- /Users/lamart/Workspace/minicode/README.md — keep aligned with implemented commands, setup, and safety workflows.
- /Users/lamart/Workspace/minicode/docs — extend with architecture, configuration, and runbook documentation.

**Verification**

1. Automated checks:
   - Build passes.
   - Lint passes.
   - Unit and integration tests pass with at least 80 percent coverage for core modules.
2. Functional acceptance checks:
   - Execute three representative tasks successfully end to end on fixture repositories.
   - Confirm final summary includes changed files, commands executed, and outcome status.
   - Confirm doctor produces actionable diagnostics.
3. Safety checks:
   - Validate dry-run causes no file writes and no side-effecting command execution.
   - Validate strict approval blocks risky operations without explicit confirmation.
   - Validate workspace sandbox blocks edits outside cwd.
4. Non-functional checks:
   - Startup under 1.5 seconds on target laptop profile.
   - Median tool overhead under 200 milliseconds excluding command runtime.
   - Validate core command flows on both macOS and Linux target environments.
5. Replay checks:
   - Replay can load and present prior run artifacts by run id.

**Decisions**

- Included in scope: local-first CLI agent behavior, tool runtime, safety controls, persistence, and test strategy defined in specification.
- Excluded from scope: model hosting/provisioning and IDE extension implementation.
- Recommended delivery strategy: first ship run and plan vertical slices, then expand to apply, doctor, replay, and chat on the same core runtime.
