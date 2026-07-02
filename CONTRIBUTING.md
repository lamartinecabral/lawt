# Contributing to lawt

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure an OpenAI-compatible provider
4. Install Google Chrome if you want to work on the web-search tools

The default local setup uses Ollama:

```bash
export PROVIDER_BASE_URL=http://localhost:11434/v1
export PROVIDER_API_KEY=ollama
export PROVIDER_MODEL_ID=qwen3:latest
```

You can also point the CLI at any other OpenAI-compatible endpoint by changing those environment variables.

The CLI currently reads provider configuration directly from `process.env`; it does not load `.env` files by itself.

## Development Workflow

1. Make your changes in `src/` and add or update tests under `tests/` when behavior changes
2. Run the tests: `npm test`
3. Run the linter: `npm run lint`
4. Run the typecheck: `npm run typecheck`
5. Check formatting: `npm run format:check`
6. Apply fixes when needed: `npm run lint:fix` and `npm run format`

## Code Style

- Code is formatted with [Prettier](https://prettier.io)
- Code is linted with [ESLint](https://eslint.org) (see [eslint.config.mjs](eslint.config.mjs))
- TypeScript source files use native ESM imports and explicit `.ts` extensions
- Tests use Node's built-in test runner
- Prefer small, workspace-scoped behavior tests for tool changes

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/cli.ts` | CLI entry point and provider configuration |
| `src/run.ts` | Streaming chat loop and tool orchestration |
| `src/io.ts` | Terminal input handling and request aborts |
| `src/tools/` | Workspace and web tool implementations |
| `src/tools/web-search/` | Browser-backed search and page extraction helpers |
| `tests/` | `node:test` coverage for the tool registry |
| `eslint.config.mjs` | ESLint flat config |
| `package.json` | Scripts, runtime metadata, and dependencies |

## Notes for Tool Changes

- Tool inputs are validated with `zod` schemas in each `*.tool.ts` file.
- Filesystem tools must stay confined to the current workspace.
- `executeToolCall` logs tool invocations to `~/.lawt/.tool_logs.jsonl`; keep that behavior intact unless the logging contract is intentionally changing.
- `web_search` and `fetch_page_content` depend on Puppeteer and a local Chrome executable.
