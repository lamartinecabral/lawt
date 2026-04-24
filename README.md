# minicode

A lightweight AI agent CLI powered by [Ollama](https://ollama.com). It provides an interactive chat with tool-calling capabilities, letting the AI execute bash commands on your system.

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
| `-m, --model <model>`    | Ollama model to use                                              | `gpt-oss:20b`                                |
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
minicode -m gpt-oss:20b -p "list files in the current directory"
```

Enable thinking mode:

```bash
minicode -t high
```

Type `/exit` to quit the session.

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
```

## Architecture

```
src/
  cli.mjs          # Main CLI entry point — handles argument parsing and REPL loop
  run.mjs          # Core execution logic — manages the LLM interaction loop and tool dispatch
  tools.mjs        # Tool definitions and registry
  utils.mjs        # Shared utilities (Ollama client, readline interface, etc.)
```

## License

ISC
