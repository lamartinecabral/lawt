# minicode

A lightweight CLI AI agent powered by [Ollama](https://ollama.com). It provides an interactive chat with tool-calling capabilities, letting the AI execute bash commands on your system.

## Prerequisites

- [Node.js](https://nodejs.org) >= 18
- [Ollama](https://ollama.com) running locally with a model pulled (default: `gemma4:e2b`)

## Installation

```bash
npm install
```

## Usage

```bash
node src/cli.mjs [options]
```

### Options

| Flag                     | Description                                                      | Default                                      |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------- |
| `-v, --version`          | Print version                                                    |                                              |
| `-m, --model <model>`    | Ollama model to use                                              | `gemma4:e2b`                                 |
| `-p, --prompt <prompt>`  | Initial prompt (skips first interactive input)                   |                                              |
| `-t, --think <value>`    | Enable model thinking (`true`, `false`, `high`, `medium`, `low`) |                                              |
| `-s, --system <value>`   | System prompt                                                    | `You are an assistant with access to tools.` |
| `-c, --context <number>` | Context length                                                   | `16000`                                      |

### Examples

Start an interactive session:

```bash
node src/cli.mjs
```

Use a specific model with an initial prompt:

```bash
node src/cli.mjs -m llama3 -p "list files in the current directory"
```

Enable thinking mode:

```bash
node src/cli.mjs -t high
```

Type `exit` to quit the session.

## Tools

The agent has access to the following tools:

### `run_bash_command`

Executes a bash shell command on the host system. The AI can use this to read files, navigate directories, install packages, or run scripts. Commands have a 15-second timeout.

## Development

```bash
# Run linter
npm run lint

# Run formatter check
npm run format:check

# Apply formatting
npm run format

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture

```
src/
  cli.mjs          # Main CLI entry point — REPL loop, tool dispatch, streaming output
tests/
  unit.test.mjs    # Unit tests for utility functions and tool logic
  e2e.test.mjs     # End-to-end CLI tests
```

## License

ISC
