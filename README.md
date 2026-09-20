# lawt

**Local AI With Tools** is a terminal agent for OpenAI-compatible chat endpoints. It can inspect and modify the current workspace, run shell commands, and optionally search the web.

## Requirements

- Node.js 24 or newer
- An OpenAI-compatible provider

The default provider is Ollama at `http://localhost:11434/v1`.

## Install

```bash
npm install
npm run install:lawt
```

Start a chat with:

```bash
lawt -m <model>
```

If no model is configured, `lawt` lists the models available from the provider. See [docs/ollama.md](docs/ollama.md) for Ollama settings recommended for longer sessions.

## Configuration

To use another OpenAI-compatible provider, create `~/.lawt/provider.ts`:

```ts
export default {
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
};
```

The same file can configure an optional web-search provider:

```ts
export default {
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
  webSearch: {
    tavily: { apiKey: "your-tavily-api-key" },
  },
};
```

The chat provider must implement the OpenAI chat completions API. If the provider file is missing or incomplete, `lawt` falls back to Ollama. `CHROME_PATH` can be used to select the Chrome executable for browser-backed web tools.

## Options and commands

```text
-m, --model <model>   Model to use
-t, --think <value>   Reasoning effort
-r, --resume          Resume the current directory's last session
-v, --version         Print the version
```

Inside a session:

- `/model` lists available models
- `/export` saves the conversation as JSON
- `/exit` or `/quit` ends the session
- Enter `"""` on its own line to start or finish a multiline prompt
- Press `Esc` to cancel a request or `Ctrl+C` to exit

Model and reasoning settings are saved in `~/.lawt/settings.json`; sessions are stored in `~/.lawt/sessions/`.

Optional instructions are loaded from `./AGENTS.md`, then `~/.lawt/AGENTS.md`.

## Tools

The agent can list, read, search, create, and edit workspace files; run shell commands; and search or fetch web pages. Filesystem tools are restricted to the current working directory.

## Development

```bash
npm test
npm run lint
npm run typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## License

MIT
