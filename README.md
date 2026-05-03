# minicode

A lightweight AI agent CLI powererd by [Ollama](https://ollama.com).

## Prerequisites

- [Node.js](https://nodejs.org) >= 24
- [Ollama](https://ollama.com/download) running locally
- A tool-calling capable [model](https://ollama.com/search?c=tools)

## Installation

```bash
npm install
npm link
```

## Usage

```bash
minicode [options]
```

### Options

| Flag                     | Description                                                      | Default                                      |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------- |
| `-v, --version`          | Print version                                                    |                                              |
| `-m, --model <model>`    | Ollama model to use                                              | `gemma4:e2b`                                 |
| `-p, --prompt <prompt>`  | Initial prompt (skips first interactive input)                   |                                              |
| `-t, --think <value>`    | Enable model thinking (`true`, `false`, `high`, `medium`, `low`) |                                              |
| `-s, --system <value>`   | System prompt                                                    | `You are an assistant with access to tools.` |
| `-c, --context <number>` | Context length                                                   | `32000`                                      |

### Examples

Start an interactive session:

```bash
minicode
```

Use a specific model with an initial prompt:

```bash
minicode -m gemma4:e2b -p "list files in the current directory"
```

Enable thinking mode:

```bash
minicode -t high
```

Type `/exit` to quit the session.

## Tools

The shared tool registry currently exposes these workspace-scoped tools:

- `list_directory`
- `read_file`
- `create_file`
- `update_file`
- `file_search`
- `grep_search`
- `run_shell_command`

## Development

```bash
# Run tests
npm test

# Run linter
npm run lint

# Run typecheck
npm run typecheck

# Run formatter check
npm run format:check

# Apply formatting
npm run format
```

## Architecture

```
src/
  cli.ts                   # Dispatches to the active provider branch
  utils.ts                 # Shared readline helpers and model utilities
  branches/
    ollama/
      cli.ts               # Ollama CLI and command handling
      run.ts               # Ollama chat loop and tool execution
    gemma/
      cli.ts               # Gemini/Gemma CLI setup
      run.ts               # Gemini chat loop and tool execution
  tools/
    index.ts               # Shared tool registry and provider adapters
    *.tool.ts              # Individual workspace tool implementations
tests/
  tools.test.ts            # Baseline Vitest coverage for the active tool registry
```

Vitest is configured for TypeScript test files under `tests/`.

## License

ISC
