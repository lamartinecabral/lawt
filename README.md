# lawt

Local AI With Tools. A lightweight CLI agent that talks to any OpenAI-compatible chat endpoint and gives the model a small, workspace-scoped tool registry.

## Overview

`lawt` runs a terminal chat loop backed by the OpenAI Node SDK. By default it targets a local Ollama-compatible endpoint, but it can be pointed at any provider that implements the OpenAI chat completions API.

At runtime it:

- loads a system prompt from `./AGENTS.md` or `~/.lawt/AGENTS.md` when present
- prompts for user input in the terminal
- streams assistant output and reasoning
- executes tool calls against the current workspace
- appends tool execution logs to `~/.lawt/.tool_logs.jsonl`

## Prerequisites

- Node.js >= 24
- Google Chrome installed for `web_search` and `fetch_page_content`
- An OpenAI-compatible provider endpoint

The default local configuration expects Ollama's OpenAI-compatible API at `http://localhost:11434/v1`.

## Installation

```bash
npm install
chmod +x src/cli.ts
npm link
```

## Running

```bash
lawt [options]
```

Or directly from the repository:

```bash
npm start
```

If no model is configured, `lawt` lists the available models exposed by the provider and exits.

## CLI options

- `-v, --version` - print the CLI version
- `-m, --model <model>` - model id to use for chat completions
- `-t, --think <think>` - provider-specific reasoning effort value

## Environment variables

You can configure the provider without changing code:

```bash
PROVIDER_BASE_URL=http://localhost:11434/v1
PROVIDER_API_KEY=ollama
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

- `PROVIDER_BASE_URL` defaults to `http://localhost:11434/v1`
- `PROVIDER_API_KEY` defaults to `ollama`
- `CHROME_PATH` overrides the Chrome executable path used by browser-backed tools

The CLI reads these values from `process.env`. Export them in your shell, your terminal profile, or another environment loader that runs before `lawt` starts.

## System prompt loading

`lawt` uses this precedence for the system prompt:

1. `./AGENTS.md`
2. `~/.lawt/AGENTS.md`
3. the built-in default: `You are an assistant with access to tools.`

## Interactive usage

- Type normally for single-line prompts.
- Enter `"""` on its own line to start a multi-line prompt, then `"""` again to submit it.
- Use `/exit` or `/quit` to end the session.
- Press `Esc` to abort an in-flight request.
- Press `Ctrl+C` to exit cleanly.

## Tools

The current tool registry exposes these functions to the model:

- `list_directory`
- `read_file`
- `create_file`
- `replace_string_in_file`
- `file_search`
- `grep_search`
- `run_shell_command`
- `web_search`
- `fetch_page_content`

All filesystem tools are constrained to the current working directory. Paths that resolve outside the workspace are rejected.

## Development

```bash
npm test
npm run lint
npm run typecheck
npm run format:check
```

Use these when you need automatic fixes:

```bash
npm run lint:fix
npm run format
```

## Architecture

```text
src/
  cli.ts                   # CLI setup, provider configuration, system prompt loading
  io.ts                    # readline loop, multiline input, abort handling
  run.ts                   # chat loop, streaming output, tool execution
  utils.ts                 # shared helpers and project root detection
  tools/
    index.ts               # tool registry, OpenAI schema conversion, call logging
    utils.ts               # tool helpers, workspace path enforcement, shell execution
    *.tool.ts              # individual tool implementations
    web-search/
      utils.ts             # Puppeteer + extract-content integration
tests/
  tools.test.ts            # node:test coverage for the tool registry
```

## License

MIT
