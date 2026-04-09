# minicode

A Node.js CLI coding agent scaffold aligned with the project specification in `docs/specification.md`.

This repository is the starting point for a local-first CLI agent that can inspect a codebase, build plans, execute tool-augmented edits, run validation commands, and summarize results.

> Model runtime is not included in this repo. The agent is designed for use with a user-provided local model backend such as Ollama.

## Key Concepts

- CLI-driven workflow for coding tasks
- Tool adapters for file edits, search, shell execution, and git operations
- Safety guardrails with dry-run, approval modes, and workspace sandboxing
- Validation loops for lint/test/build after edits
- Structured run metadata and summaries

## Recommended Usage

This repository now includes a Phase 1 CLI bootstrap for the `agent` command shell. After installing dependencies, build the project and run the command driver.

- `docs/specification.md` — full project requirements and architecture
- `docs/implementation-plan.md` — phased roadmap for the CLI agent
- `agent run`, `agent plan`, `agent apply`, `agent doctor`, `agent replay`, `agent chat`

## Installation

Install dependencies and build the CLI:

```bash
npm install
npm run build
```

## Development

This repo is intended to be extended into a TypeScript-based CLI agent. Proposed packages include:

- `commander`, `enquirer`, `chalk`, `ora`
- `execa`, `fast-glob`, `ignore`, `zod`, `cosmiconfig`
- `pino`, `nanoid`, `vitest`, `eslint`, `prettier`

## Project Structure

A recommended structure is described in `docs/specification.md` and may include:

```text
src/
  cli/
  core/
  context/
  tools/
  provider/
  memory/
  config/
  types/
tests/
docs/
```

## Documentation

- `docs/specification.md` — full specification for the Node.js CLI coding agent
- `docs/implementation-plan.md` — step-by-step roadmap for building the agent

## Project Status

Tracking implementation progress against the Implementation Plan:

- [x] **Phase 1: Bootstrap project foundation**
- [x] **Phase 2: Define contracts and core module boundaries**
- [x] **Phase 3: Implement context engine and tool runtime**
- [x] **Phase 4: Implement orchestrator planning and execution loop**
- [ ] **Phase 5: Implement CLI commands end to end**
- [ ] **Phase 6: Add memory store and artifact persistence**
- [ ] **Phase 7: Safety and approval hardening**
- [ ] **Phase 8: Validation loop and change summary quality**
- [ ] **Phase 9: Testing and performance verification**
- [ ] **Phase 10: Documentation and release readiness**

## Notes

- This repo currently contains only the spec and minimal scaffold.
- The local model provider and Ollama integration are intentionally left to the user.
- Future work should implement the CLI, tool runtime, session memory, and validation hooks described in the spec.
