# lawt

**Local AI With Tools** is a terminal assistant that chats with an OpenAI-compatible model and can use tools to work with files, run shell commands, and search the web.

## Requirements

- Node.js 24 or newer
- Ollama running locally, or another OpenAI-compatible provider

## Run

```bash
npm install
npm run install:lawt
lawt --model <model>
```

Use `--think <effort>` to set reasoning effort, or `--resume` to continue the session for the current working directory. Options can also be passed as `-m`, `-t`, and `-r`. The selected model and reasoning effort are saved in `~/.lawt/settings.json`.

## Using the assistant

Enter a prompt at the terminal. For a multi-line prompt, put `"""` on a line by itself before and after the text. Available commands are `/exit` or `/quit` to leave, `/export` to save the conversation as JSON, and `/model` to list available models.

The assistant can browse and edit files in the current workspace, run shell commands, and search or fetch web pages. Optional instructions load from `./AGENTS.md` or `~/.lawt/AGENTS.md`. Sessions are saved under `~/.lawt/sessions/` by working directory. See [docs/ollama.md](docs/ollama.md) for Ollama usage tips.

## Providers

Use `~/.lawt/provider.ts` to configure a different OpenAI-compatible model provider or a cloud web search provider:

```ts
export default {
  // Optional: use a non-default model provider
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
  // Optional: configure cloud web search independently
  webSearch: {
    tavily: { apiKey: "your-tavily-api-key" },
    // or ollama: { apiKey: "your-ollama-api-key" },
    // or local: { chromePath: "default or path/to/chrome" },
  },
};
```

For more details on web search settings, see [github.com/lamartinecabral/web-search](https://github.com/lamartinecabral/web-search).

## Development

```bash
npm test
npm run typecheck
npm run lint
```
