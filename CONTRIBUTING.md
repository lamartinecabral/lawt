# Contributing to minicode

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Ensure [Ollama](https://ollama.com) is installed and running locally

## Development Workflow

1. Make your changes in `src/`
2. Run the linter: `npm run lint`
3. Run the formatter: `npm run format`
4. Run the tests: `npm test`

## Code Style

- Code is formatted with [Prettier](https://prettier.io) (see [.prettierrc](.prettierrc))
- Code is linted with [ESLint](https://eslint.org) (see [eslint.config.mjs](eslint.config.mjs))
- ES modules (`.mjs`) are used throughout

## Testing

- **Unit tests** (`tests/unit.test.mjs`): test utility functions and isolated tool logic
- **E2E tests** (`tests/e2e.test.mjs`): test CLI flags, help output, and argument validation

Run all tests:

```bash
npm test
```

## Project Structure

| Path                  | Purpose              |
| --------------------- | -------------------- |
| `src/cli.mjs`         | Main CLI entry point |
| `tests/unit.test.mjs` | Unit tests           |
| `tests/e2e.test.mjs`  | End-to-end tests     |
| `eslint.config.mjs`   | ESLint flat config   |
| `.prettierrc`         | Prettier config      |
| `vitest.config.mjs`   | Vitest config        |
