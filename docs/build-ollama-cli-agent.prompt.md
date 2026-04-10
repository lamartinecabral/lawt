Act as a senior Node.js engineer. Autonomously build a production-grade CLI AI agent powered by Ollama in the current directory.

Primary objective
Build a Node.js CLI agent that can reason, call file-operation tools, and complete multi-step tasks in a workspace. Include linting, type-checking, and end-to-end tests. Do not stop until everything is implemented and all checks pass.

Use this stack (unless there is a hard blocker)
- Node.js 22+
- TypeScript (strict mode), ESM
- commander (CLI)
- ollama (official JS client)
- zod (tool schemas + validation)
- fs-extra + fast-glob (file operations and search)
- picocolors + ora (terminal UX)
- pino (logging)
- vitest + execa + @vitest/coverage-v8 (testing)
- eslint flat config + @eslint/js + typescript-eslint + prettier
- tsx + tsup + rimraf

Implementation requirements

1. Bootstrap
- Initialize package.json with type: module.
- Set up tsconfig.json with strict settings.
- Add scripts:
  - dev
  - build
  - start
  - lint
  - lint:fix
  - typecheck
  - test
  - test:e2e
  - check (lint + typecheck + test)
- Add a bin entry so the CLI can be installed with npm link.

2. CLI
- Command: chat
  - Interactive REPL with streaming model tokens.
- Command: run <task>
  - Fully autonomous execution where the model can call tools repeatedly until completion or max steps.
- Command: tools
  - Print available tool names and schemas.
- Global options:
  - --model (default: gpt-oss:20b)
  - --host (default: http://127.0.0.1:11434)
  - --cwd (default: process.cwd())
  - --max-steps (default: 20)
  - --json (machine-readable output)
  - --verbose

3. Ollama integration
- On startup, verify Ollama connectivity and fail with a friendly actionable message if offline.
- Verify model existence; if missing, pull the model with visible progress.
- Use Ollama chat API with tool definitions.
- Support response streaming.
- Maintain structured conversation history and tool results.

4. Tool system (mandatory)
Implement a typed tool registry using zod schemas with these tools:
- list_dir(path, recursive?, pattern?)
- read_file(path, startLine?, endLine?, maxBytes?)
- write_file(path, content, overwrite?)
- append_file(path, content)
- replace_in_file(path, search, replace, isRegex?, replaceAll?)
- delete_file(path)
- move_file(from, to)
- mkdir(path, recursive?)
- glob_search(pattern, cwd?)
- grep_search(query, includePattern?)

Safety constraints:
- Hard sandbox all operations to --cwd.
- Block path traversal and any path outside sandbox.
- Resolve symlinks and block symlink escapes.
- Reject binary files for text operations.
- Enforce file size limits for read/write.
- Every tool returns structured success/error payloads.

5. Autonomous loop
- Implement deterministic loop:
  - send messages + tool schemas to model
  - execute requested tools
  - append tool outputs back into messages
  - repeat until final assistant answer or max steps reached
- In verbose mode, show per-step logs.
- In json mode, output:
  - finalResponse
  - steps
  - toolCalls
  - changedFiles
  - errors

6. Code quality
- ESLint flat config with practical strict rules.
- Prettier config.
- No loose typing; avoid any except isolated justified cases.
- Keep modules small and testable.
- Add concise comments only for non-obvious logic.

7. Tests
Create unit and e2e tests.

Unit tests must cover:
- sandbox path validation
- tool schema input validation
- replace_in_file behavior (single/multi/no match)
- loop stop conditions and max-steps handling

E2E tests must not require a real local model:
- Spin up a lightweight mock Ollama HTTP server in tests using Node http.
- Point CLI --host to that mock server.
- Required e2e cases:
  - help output
  - single run task returns deterministic mocked response
  - autonomous tool-calling flow creates/edits files correctly
  - path traversal attempt is blocked
  - offline host failure exits with code 1 and friendly message
  - missing model triggers pull flow against mocked endpoints

8. Project structure
Create a clean structure along these lines:
- bin/
- src/
- src/agent/
- src/tools/
- src/cli/
- src/lib/
- tests/unit/
- tests/e2e/

9. Documentation
Write README.md with:
- prerequisites
- install + npm link
- Ollama setup
- usage examples for chat and run
- safety model
- dev/test/lint commands

10. Completion gate (mandatory)
Do not finish until all pass:
- npm run lint
- npm run typecheck
- npm test
- npm run build

If a check fails, fix and rerun until all are green.

At the end, provide:
- architecture summary
- key files created
- test/lint/typecheck/build results
- example commands for first run
No TODO placeholders allowed.