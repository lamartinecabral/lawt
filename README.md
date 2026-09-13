# lawt

Local AI With Tools. A lightweight CLI agent that talks to any OpenAI-compatible chat endpoint and gives the model a small, workspace-scoped tool registry.

## Overview

`lawt` runs a terminal chat loop backed by the OpenAI Node SDK. By default it targets a local Ollama-compatible endpoint, but it can be pointed at any provider that implements the OpenAI chat completions API.

At runtime it:

- loads a system prompt from `./AGENTS.md` or `~/.lawt/AGENTS.md` when present
- prompts for user input in the terminal
- streams assistant output and reasoning
- executes tool calls against the current workspace

## Prerequisites

- Node.js >= 24
- One of the supported web-search backends, if you want `web_search` and
  `fetch_page_content`: Ollama Cloud, Tavily, or a locally installed Google
  Chrome
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

For Ollama-specific setup guidance for longer agent sessions, see [docs/ollama.md](docs/ollama.md).

## CLI options

- `-v, --version` - print the CLI version
- `-m, --model <model>` - model id to use for chat completions
- `-t, --think <think>` - provider-specific reasoning effort value

The selected model and reasoning effort are saved in `~/.lawt/settings.json`
and used as defaults on future executions. Command-line options override the
saved values. Use `--think null` to save an explicitly disabled reasoning
effort.

## Provider configuration

`lawt` uses Ollama by default. To connect to another OpenAI-compatible
provider, create `~/.lawt/provider.ts` with a default export containing its
base URL and API key:

```bash
mkdir -p ~/.lawt
```

```ts
// ~/.lawt/provider.ts
export default {
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
};
```

The file is loaded when `lawt` starts. Both `baseURL` and `apiKey` are
required; if the file is missing or either value is not set, `lawt` falls back
to Ollama at `http://localhost:11434/v1` with the API key `ollama`.

The provider must expose the OpenAI chat completions API. Select a model from
that provider with `-m, --model`.

The same provider file can configure a web-search backend. The first available
option is selected in this order: Ollama Cloud, Tavily, then local Chrome.
If none is configured or available, the web-search tools are omitted.

```ts
// ~/.lawt/provider.ts
export default {
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
  webSearch: {
    ollama: { apiKey: "your-ollama-web-api-key" },
    // or: tavily: { apiKey: "your-tavily-api-key" },
  },
};
```

Ollama Cloud and Tavily are used only for web search and page fetching;
the chat provider remains configured by `baseURL` and `apiKey`.

`CHROME_PATH` remains an environment variable and overrides the Chrome
executable path used by browser-backed tools:

```bash
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome lawt
```

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
```

Use these when you need automatic fixes:

```bash
npm run lint:fix
```

## Architecture

```text
src/
  cli.ts                   # CLI setup, provider configuration, system prompt loading
  io.ts                    # readline loop, multiline input, abort handling
  run.ts                   # chat loop, streaming output, tool execution
  utils.ts                 # shared helpers and project root detection
  tools/
    index.ts               # tool registry, OpenAI schema conversion
    utils.ts               # tool helpers, workspace path enforcement, shell execution
    *.tool.ts              # individual tool implementations
    web-search/
      index.ts             # web-search backend selection
      *-client.ts          # Ollama, Tavily, and local Chrome backends
      utils.ts             # shared web-search result types
tests/
  tools.test.ts            # node:test coverage for the tool registry
```

## License

MIT
