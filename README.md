# LAWT

[![Tests](https://github.com/lamartinecabral/lawt/actions/workflows/test.yml/badge.svg)](https://github.com/lamartinecabral/lawt/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/github/license/lamartinecabral/lawt)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Ollama](https://img.shields.io/badge/Ollama-FFFFFF?logo=ollama&logoColor=black)](https://ollama.com/)

**Local AI With Tools** is a small terminal agent for OpenAI-compatible models. It can work with files in the current directory, run shell commands, and search the web.

`lawt` is intentionally a minimal implementation: the code should be easy for anyone to understand, own, and adapt to their own workflow. Its small surface area also keeps the context sent to local models clean and lightweight, leaving more room for the task at hand.

![lawt screenshot](./screenshot.png)

## Requirements

- Node.js 24 or newer
- Ollama running locally, or another OpenAI-compatible provider

## Run

```bash
npm install
npm run install:lawt
lawt list
lawt --model <model>
```

Use `--think <effort>` to set reasoning effort, `--resume` to continue the session for the current working directory, or `--custom` to allow a model ID now shown in the available list.

## Using the assistant

Enter a prompt at the terminal. For a multi-line prompt, put `"""` on a line by itself before and after the text. Available commands are `/exit` or `/quit` to leave, `/export` to save the conversation as JSON, and `/model` to list available models.

The assistant can browse and edit files in the current workspace, run shell commands, and search or fetch web pages. A custom system prompt is loaded from `./AGENTS.md` or `~/.lawt/AGENTS.md`.

See [docs/ollama.md](docs/ollama.md) for Ollama usage tips.

## Providers

Use `~/.lawt/provider.ts` to configure a different OpenAI-compatible model provider or a web search provider:

```ts
export default {
  // Optional: use a non-default model provider
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
  // Optional: choose one web search backend
  webSearch: {
    puppeteer: { chromePath: "default" },
    // or puppeteer: { chromePath: "path/to/chrome" },
    // or tavily: { apiKey: "your-tavily-api-key" },
    // or ollama: { apiKey: "your-ollama-cloud-api-key" },
  },
};
```

For more details on web search settings, see [github.com/lamartinecabral/web-search](https://github.com/lamartinecabral/web-search).

## Development

```bash
npm run lint
npm run typecheck
npm test
```
