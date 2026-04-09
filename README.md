# minicode

A Node.js CLI coding agent scaffold aligned with the project specification in `docs/specification.md`.

This repository contains a local-first CLI coding agent implementation with a working `agent` command surface and persistence paths for recorded runs.

> Model runtime is not included in this repo. The agent is designed for use with a user-provided local model backend such as Ollama.

## Key Concepts

- CLI-driven workflow for coding tasks
- Tool adapters for file edits, search, shell execution, and git operations
- Safety guardrails with dry-run, approval modes, and workspace sandboxing
- Validation loops for lint/test/build after edits
- Structured run metadata and summaries

## Recommended Usage

This repository includes a working `agent` CLI with the following commands:

- `agent run <task>` — execute a task with planning, validation, and summary reporting
- `agent plan <task>` — generate a deterministic plan without applying changes
- `agent apply <plan-file>` — apply a saved plan to the repository
- `agent doctor` — inspect environment and repository health
- `agent replay <run-id>` — replay a previously recorded run summary
- `agent chat` — start an interactive chat session for iterative coding assistance

After installing dependencies, build the CLI and run one of the commands.

- `docs/specification.md` — full project requirements and architecture
- `docs/implementation-plan.md` — phased roadmap for building the agent
- `docs/release.md` — packaging, release readiness, and documentation guidance

## Installation

Install dependencies and build the CLI:

```bash
npm install
npm run build
```

Run the test suite with coverage:

```bash
npm run coverage
```

## Development

The project is implemented using TypeScript and includes a complete CLI command flow, persistence, provider adapter scaffolding, and test coverage for core modules.

Key packages in use:

- `commander`, `chalk`, `cosmiconfig`, `zod`
- `pino`, `nanoid`, `better-sqlite3`
- `vitest`, `eslint`, `prettier`, `tsup`

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
 - `docs/openai-provider-integration-plan.md` — provider integration plan for OpenAI-compatible adapters and environment-driven configuration

## Project Status

Tracking implementation progress against the Implementation Plan:

- [x] **Phase 1: Bootstrap project foundation**
- [x] **Phase 2: Define contracts and core module boundaries**
- [x] **Phase 3: Implement context engine and tool runtime**
- [x] **Phase 4: Implement orchestrator planning and execution loop**
- [x] **Phase 5: Implement CLI commands end to end**
- [x] **Phase 6: Add memory store and artifact persistence**
- [x] **Phase 7: Safety and approval hardening**
- [x] **Phase 8: Validation loop and change summary quality**
- [x] **Phase 9: Testing and performance verification**
- [x] **Phase 10: Documentation and release readiness**

**Provider Integration Plan**

- [ ] **Phase 1: Configuration and Validation** — add `.env` loading, extend config schema, validate `OPENAI_BASE_URL` and `OPENAI_API_KEY`.
- [ ] **Phase 2: Provider Adapter Implementation** — implement OpenAI-compatible adapter and map responses to existing model response types.
- [ ] **Phase 3: CLI Wiring and Adapter Selection** — wire the new adapter into `agent run`, `plan`, and `chat` flows.
- [ ] **Phase 4: Security, Logging, and Persistence Hardening** — redact secrets from logs and avoid persisting API keys.
- [ ] **Phase 5: Test Coverage** — add unit and integration tests for config and provider behavior.
- [ ] **Phase 6: Documentation & Developer Experience** — add `.env.example` and README setup docs for providers.

## Notes

- The repo now includes a working CLI with planning, execution, persistence, replay, and chat flow.
- Run metadata, artifacts, and replay history are persisted under the workspace directory in `.minicode/runstore.sqlite`.
- The local model provider and Ollama integration are intentionally left to the user.
- Future work may add richer model adapters, shell sandboxing enforcement, and extended validation hooks.
