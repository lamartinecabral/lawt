# Contributing to lawt

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure an OpenAI-compatible provider if you do not want to use the
   default local Ollama endpoint
4. Configure a web-search backend or install Google Chrome if you want to work
   on the web-search tools

The default local setup uses Ollama, so no provider configuration is needed.
To use another OpenAI-compatible endpoint, create `~/.lawt/provider.ts`:

```ts
export default {
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
};
```

The provider file must export an object with both `baseURL` and `apiKey`.
The CLI falls back to Ollama when the file is missing or incomplete. Choose a
model exposed by the provider with `lawt -m <model>`.

Web search uses the first available backend in this order: Ollama Cloud,
Tavily, then local Chrome. Add one of these optional entries to the same
`~/.lawt/provider.ts` file:

```ts
webSearch: {
  ollama: { apiKey: "your-ollama-web-api-key" },
  // or: tavily: { apiKey: "your-tavily-api-key" },
},
```

If no backend is available, `web_search` and `fetch_page_content` are not
registered for the model. `CHROME_PATH` can override the local Chrome
executable path.

The CLI does not load provider configuration from environment variables or
`.env` files. `CHROME_PATH` is still read from the environment to configure the
Chrome executable used by browser-backed tools.

## Development Workflow

1. Make your changes in `src/` and add or update tests under `tests/` when behavior changes
2. Run the tests: `npm test`
3. Run the formatter and linter checks: `npm run lint`
4. Run the typecheck: `npm run typecheck`
5. Apply formatting and lint fixes when needed: `npm run lint:fix`

## Code Style

- Code is formatted and linted with [Biome](https://biomejs.dev) (see [biome.json](biome.json))
- `npm run lint` checks formatting and lint rules
- `npm run lint:fix` formats files and applies safe lint fixes
- TypeScript source files use native ESM imports and explicit `.ts` extensions
- Tests use Node's built-in test runner
- Prefer small, workspace-scoped behavior tests for tool changes

## Project Structure

| Path                    | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `src/cli.ts`            | CLI entry point and provider configuration        |
| `src/run.ts`            | Streaming chat loop and tool orchestration        |
| `src/io.ts`             | Terminal input handling and request aborts        |
| `src/tools/`            | Workspace and web tool implementations            |
| `src/tools/web-search/` | Browser-backed search and page extraction helpers |
| `tests/`                | `node:test` coverage for the tool registry        |
| `biome.json`            | Biome formatter and linter configuration           |
| `package.json`          | Scripts, runtime metadata, and dependencies       |

## Notes for Tool Changes

- Tool inputs are validated with `zod` schemas in each `*.tool.ts` file.
- Filesystem tools must stay confined to the current workspace.
- `web_search` and `fetch_page_content` use the configured Ollama Cloud or
  Tavily backend when available; otherwise they fall back to Puppeteer and a
  local Chrome executable.
