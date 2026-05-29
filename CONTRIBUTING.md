# Contributing to lawt

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Ensure [Ollama](https://ollama.com) is installed and running locally

## Development Workflow

1. Make your changes in `src/` and add or update tests under `tests/` when behavior changes
2. Run the tests: `npm test`
3. Run the linter: `npm run lint`
4. Run the typecheck: `npm run typecheck`
5. Run the formatter when needed: `npm run format`

## Code Style

- Code is formatted with [Prettier](https://prettier.io) (see [.prettierrc](.prettierrc))
- Code is linted with [ESLint](https://eslint.org) (see [eslint.config.mjs](eslint.config.mjs))
- TypeScript source files use native ESM imports and explicit `.ts` extensions
- Vitest looks for test files under `tests/**/*.test.{ts,mts,js,mjs}`

## Project Structure

| Path                       | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `src/cli.ts`               | Entry point that dispatches to a branch CLI |
| `src/branches/ollama/`     | Ollama-specific CLI and chat runtime        |
| `src/branches/gemma/`      | Gemini/Gemma-specific CLI and chat runtime  |
| `src/branches/openrouter/` | OpenRouter-specific CLI and chat runtime    |
| `src/tools/`               | Shared workspace tool implementations       |
| `tests/`                   | Vitest unit tests                           |
| `eslint.config.mjs`        | ESLint flat config                          |
| `.prettierrc`              | Prettier config                             |
| `vitest.config.mjs`        | Vitest config                               |
