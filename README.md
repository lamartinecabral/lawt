# lawt

Local AI With Tools. A lightweight CLI agent that routes between provider branches and exposes a shared tool registry.

## Overview

`lawt` is a CLI wrapper for local and remote AI providers. The active provider branch is selected by the package version suffix:

- `ollama` → `src/branches/ollama`
- `gemma` → `src/branches/gemma`
- `openrouter` → `src/branches/openrouter`

Use `npm run activate <branch>` to switch branches via `package.json` version, then run `lawt`.

## Prerequisites

- Node.js >= 24
- Chrome installed for the web related tools
- One of the provider runtimes / credentials below:
  - `Ollama` installed and running locally for the `ollama` branch
  - `GEMINI_API_KEY` set for the `gemma` branch
  - `OPENROUTER_API_KEY` set for the `openrouter` branch

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

Or directly:

```bash
npm start
```

## Provider selection

The CLI entrypoint in `src/cli.ts` imports one of the branch CLIs based on `package.json` version.

Example branch names in `package.json`:

- `0.0.1-ollama`
- `0.0.1-gemma`
- `0.0.1-openrouter`

Switch branch:

```bash
npm run activate ollama
npm run activate gemma
npm run activate openrouter
```

## CLI options

Common options across branches:

- `-v, --version` — print the CLI version
- `-p, --prompt <prompt>` — initial prompt
- `-s, --system <value>` — system prompt (default: `You are an assistant with access to tools.`)

Branch-specific options:

- `ollama` branch:
  - `-m, --model <model>` — Ollama model to use
  - `-t, --think <value>` — thinking level: `true`, `false`, `high`, `medium`, `low`
- `openrouter` branch:
  - `-m, --model <model>` — OpenRouter model to use
  - `-t, --think <value>` — thinking level: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`
- `gemma` branch:
  - only `-p` and `-s` are exposed; the branch uses a fixed Gemini model internally

## Interactive commands

During a session, the CLI supports these slash commands:

- `/exit` — quit
- `/clear` — clear conversation context (`ollama` / `openrouter` branches)
- `/save` — save session state to `.cache/lawt_state.json`
- `/load` — load session state from `.cache/lawt_state.json`
- `/show_opts` — print current options
- `/system <text>` — update the system prompt
- `/model <model>` — change the active model (`ollama` / `openrouter` branches)
- `/think <value>` — change thinking level (`ollama` / `openrouter` branches)

## Tools

The shared tool registry exposes these workspace-scoped tools:

- `list_directory`
- `read_file`
- `create_file`
- `replace_string_in_file`
- `file_search`
- `grep_search`
- `run_shell_command`
- `web_search`
- `fetch_url`

These tools are available to the model through the provider-specific tool integration.

## Environment variables

For `gemma` branch:

```bash
GEMINI_API_KEY=your_api_key
```

For `openrouter` branch:

```bash
OPENROUTER_API_KEY=your_api_key
```

Place credentials in a `.env` file at the repository root or export them in your shell.

## Development

```bash
npm test
npm run lint
npm run lint:fix
npm run typecheck
npm run format:check
npm run format
```

## Architecture

```
src/
  cli.ts                   # top-level CLI dispatcher that chooses a branch by package version
  utils.ts                 # shared readline, prompt, and provider helper utilities
  branches/
    activate.ts            # switch active provider branch via package version suffix
    ollama/
      cli.ts               # Ollama-specific CLI options and loop
      run.ts               # Ollama chat + tool execution loop
    gemma/
      cli.ts               # Gemini/Gemma CLI options and loop
      run.ts               # Gemini chat + tool execution loop
    openrouter/
      cli.ts               # OpenRouter-specific CLI options and loop
      run.ts               # OpenRouter chat + tool execution loop
  tools/
    index.ts               # shared registry and format adapters
    utils.ts               # shared tool utilities
    *.tool.ts              # workspace tool implementations
tests/
  tools.test.ts            # Vitest coverage for the tool registry
```

## License

ISC
