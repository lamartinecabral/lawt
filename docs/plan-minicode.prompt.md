## Plan: Build Minicode CLI Agent From Spec

Build a TypeScript-first CLI agent in phased increments that deliver an end-to-end run path early (run and plan), then harden with safety controls, persistence, and test coverage to meet acceptance criteria in the specification. The approach starts from current minimal scaffold files and adds modular components aligned to the defined architecture: CLI layer, orchestrator, context engine, tool runtime, memory store, and provider adapter.

**Steps**

1. Phase 1: Bootstrap project foundation from current scaffold.
   - Update package scripts and dependency layout for TypeScript build/test/lint workflow.
   - Replace the current hello-world entry flow with an agent CLI entrypoint and command router.
   - Add baseline config loading, structured logging, and run/session id generation.
   - Output: runnable CLI shell with command parsing and global flags wired.
2. Phase 2: Define contracts and core module boundaries. Depends on Step 1.
   - Implement shared types for Plan Step, Tool Call, Run Artifact, command/result envelopes, and policy decisions.
   - Add zod schemas for external inputs and config files.
   - Define interfaces for provider adapter, tool adapter, and orchestrator lifecycle hooks.
   - Output: stable internal contracts that all modules compile against.
3. Phase 3: Implement context engine and tool runtime. Depends on Step 2.
   - Build repository index/discovery with ignore pattern handling and workspace boundary checks.
   - Implement tool registry with at least file read/search/edit and shell execution adapters.
   - Add policy preflight for tool calls (path sandbox, high-risk command checks, timeout defaults).
   - Output: policy-aware tool execution primitives usable by orchestrator.
4. Phase 4: Implement orchestrator planning and execution loop. Depends on Step 3.
   - Add plan creation pipeline from user goal and repo context.
   - Execute ordered plan steps with status transitions, retry/error semantics, and interrupt handling.
   - Add dry-run strategy that records intended actions without file/process side effects.
   - Output: deterministic run loop that can produce plans and execute them.
5. Phase 5: Implement CLI commands end to end. Depends on Step 4.
   - Deliver run and plan first as vertical slices.
   - Add apply for plan-file execution and replay for run metadata playback.
   - Add doctor diagnostics for runtime dependencies and environment validation.
   - Add chat mode as an interactive shell around the same orchestrator and memory primitives.
   - Output: full command surface from specification with consistent text and json output modes.
6. Phase 6: Add memory store and artifact persistence. Depends on Step 4, parallel with Step 5 after contracts are stable.
   - Persist run metadata, tool calls, summaries, and changed-file manifests.
   - Store replay artifacts and ensure correlation by run id.
   - Add log redaction for sensitive environment keys/values.
   - Output: reproducible runs and debuggable artifacts aligned with replay command behavior.
7. Phase 7: Safety and approval hardening. Depends on Steps 5 and 6.
   - Implement approval levels auto, on-request, strict across risky operations.
   - Enforce destructive action confirmation and guarded delete/reset behavior.
   - Add symlink and binary-file handling policy decisions and explicit user messaging.
   - Output: guardrails required for operation in non-trusted repositories.
8. Phase 8: Validation loop and change summary quality. Depends on Step 5.
   - Run lint/test/build hooks after edits with clear pass/fail reporting.
   - Generate deterministic final summaries: files changed, commands executed, outcomes.
   - Add minimal-diff editing strategy and optional revert helper behavior.
   - Output: reviewable change reports and robust validation results.
9. Phase 9: Testing and performance verification. Depends on Steps 7 and 8.
   - Add unit tests for parser, planner, tool adapters, and policy checks.
   - Add integration fixtures for at least three representative coding tasks.
   - Add snapshot tests for CLI text/json outputs.
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
   - Confirm final summary includes changed files, executed commands, and outcome status.
   - Confirm doctor produces actionable diagnostics.
3. Safety checks:
   - Validate dry-run causes no file writes and no side-effecting command execution.
   - Validate strict approval blocks risky operations without explicit confirmation.
   - Validate workspace sandbox blocks edits outside cwd.
4. Non-functional checks:
   - Startup under 1.5 seconds on target laptop profile.
   - Median tool overhead under 200 milliseconds excluding command runtime.
5. Replay checks:
   - Replay can load and present prior run artifacts by run id.

**Decisions**

- Included in scope: local-first CLI agent behavior, tool runtime, safety controls, persistence, and test strategy defined in specification.
- Excluded from scope: model hosting/provisioning and IDE extension implementation.
- Recommended delivery strategy: first ship run and plan vertical slices, then expand to apply, doctor, replay, and chat on the same core runtime.

**Further Considerations**

1. Provider adapter first target recommendation:
   - Option A: Ollama-first adapter for earliest local testing.
   - Option B: generic OpenAI-compatible local endpoint abstraction from day one.
2. Planning strategy recommendation:
   - Option A: deterministic template-driven planning for first release.
   - Option B: adaptive planning with retries and backtracking after baseline stability.
3. Persistence detail recommendation:
   - Option A: SQLite-only artifact storage.
   - Option B: SQLite metadata plus optional filesystem blob storage for large artifacts.
