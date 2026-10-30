# Contributing to LAWT

Thanks for helping improve LAWT. Contributions can include bug fixes, new tools, documentation, or improvements to the developer experience. Keep changes focused, explain behavior that is not obvious from the code, and update the documentation when user-facing behavior changes.

## Development setup

LAWT requires Node.js 24 or newer. From the repository root, install dependencies with:

```bash
npm install
```

To run the CLI from the checkout while developing, use:

```bash
npm start
```

The CLI connects to Ollama at `http://localhost:11434/v1` by default. For another OpenAI-compatible provider, configure `~/.lawt/provider.ts` as described in [PROJECT.md](./PROJECT.md).

## Before submitting a change

Run the checks relevant to your change. The full project checks are:

```bash
npm test
npm run lint
npm run typecheck
```

Tests use Node.js's built-in test runner. Add or update tests when changing behavior, especially for tool input validation, workspace path handling, settings, and session persistence. Keep tests deterministic and avoid requiring a live model or web service unless a change specifically needs integration coverage.

The lint command uses Biome and the TypeScript check runs `tsc --noEmit`. Source files use TypeScript and explicit `.ts` extensions on local imports. Follow the existing formatting and nearby patterns; `npm run lint:fix` applies Biome's automatic fixes.

## Documentation approach

Project documentation has two levels:

- **README.md is the concise overview.** Keep it focused on what LAWT does, its basic requirements, installation, and a short example that gets someone started. Link readers to the relevant documentation for deeper details instead of adding a full feature reference there.
- **PROJECT.md is the detailed project description.** Use it to explain how features work, list CLI options and tools, document persistence and configuration, and describe behavior or constraints that users may need to understand.

Use `docs/` for focused, task-specific guides, such as setting up a particular model provider. When adding a feature, put a brief mention and link in README only if it helps new users understand the project; describe its behavior and configuration in PROJECT, and add a dedicated guide when the setup warrants one. Keep the files consistent, but do not repeat the full PROJECT explanation in README.

Documentation changes should match the behavior in the code. Prefer direct, concrete language and runnable examples. Update existing links when moving or renaming documentation.

## Adding or changing tools

Tools are implemented in `src/tools/` and registered in `src/tools/index.ts`. A tool defines its name, description, Zod input schema, and async executor. The schema and description are sent to the model as a function tool, so make them specific enough for the model to choose and call the tool correctly. Return tool results using the shared success or failure helpers in `src/tools/utils.ts`.

File-oriented tools should use the shared path resolution helper so paths remain within the current workspace. Add tests for both the expected operation and important failure cases. When the user-visible tool set or its behavior changes, update [PROJECT.md](./PROJECT.md).

## Keeping changes reviewable

- Make changes that address one clear concern at a time.
- Include tests and documentation updates that are needed to explain or preserve the behavior.
- Describe user-visible changes and any relevant limitations in your contribution summary.
- Do not include generated files, local configuration, credentials, or unrelated formatting changes.
