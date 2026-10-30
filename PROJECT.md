# LAWT Project Description

LAWT stands for **Local AI With Tools**. It is a compact terminal agent for OpenAI-compatible chat completion APIs. The user talks to a model in an interactive CLI, and the model can request tools to inspect or change files in the current workspace, execute shell commands, and search or fetch web content.

The project favors a small, readable implementation that can be understood and adapted. It is built with TypeScript for Node.js and uses the OpenAI JavaScript client for the model API. Tool input schemas are defined with Zod and exposed to the model as function tools.

## Requirements and installation

- Node.js 24 or newer.
- An OpenAI-compatible API endpoint that supports chat completions and tool calls. Ollama at `http://localhost:11434/v1` is the default.

Install and link the CLI from a checkout:

```bash
npm install
npm run install:lawt
```

The `lawt` executable is then available in the shell. List provider models with `lawt list`, select one with `lawt --model <model-id>`, and start a one-off task with `lawt --model <model-id> --exec "<task>"`. Run `lawt --help` to see all CLI flags.

## Main features

### Interactive and one-off tasks

Without `--exec`, LAWT runs an interactive prompt loop. The model can respond with text, reasoning fields supplied by the provider, or tool calls. Tool results are added to the conversation and the model continues until it produces a response without another tool call. Streaming is enabled by default; `/stream` switches between streamed and non-streamed completions for the current run.

With `--exec <task>`, the prompt is sent immediately and the process exits after the task completes. Command-line options also include:

- `--model <model>` (`-m`) selects a model. The selected model and reasoning effort are saved in `~/.lawt/settings.json`.
- `--custom` (`-c`) allows a model ID without checking it against the provider's model list.
- `--think <effort>` (`-t`) sets the reasoning effort sent to the provider. Use `null` to set the `reasoning_effort` request field to `null`.
- `--resume` (`-r`) loads the saved conversation for the current working directory.
- `--temperature <number>` and `--top-p <number>` pass sampling settings to the chat completion request.

Interactive commands are `/exit` and `/quit` to leave, `/model` to list models, `/export` to save the conversation to a timestamped JSON file in the current directory, and `/stream` to toggle streaming. To enter a multi-line prompt, enter `"""` on a line by itself, type the prompt, and close it with another `"""`. Escape cancels an in-progress response; Ctrl+C cancels the response or exits when idle.

### Workspace tools

The model can call these built-in tools:

| Tool | Purpose |
| --- | --- |
| `list_directory` | List files and subdirectories at a workspace path. |
| `read_file` | Read a file, optionally selecting a 1-indexed line range. |
| `write_file` | Create a file and parent directories, or overwrite an existing file. |
| `replace_string_in_file` | Replace one exact, unique string in a file. |
| `file_search` | Find files by glob pattern. |
| `grep_search` | Search file contents with a literal string or regular expression. |
| `run_shell_command` | Run a shell command from the current working directory. |
| `web_search` | Search the live web. |
| `fetch_page_content` | Fetch a URL and extract its page text. |

File tools resolve paths against the current working directory and reject paths that resolve outside it. Shell commands run from that directory with a 15-second timeout. Successful tool output is limited to 10,000 characters before being passed back to the model.

### Conversation persistence

Sessions are stored as JSON Lines under `~/.lawt/sessions/`, with a separate file keyed by the resolved current working directory. They are saved as the assistant responds, and `--resume` reloads the conversation associated with the directory where LAWT was launched. Settings are stored in `~/.lawt/settings.json`.

### System prompt customization

By default, the system prompt is `You are an assistant with access to tools.` LAWT replaces it with the contents of the first non-empty prompt file it finds, checking `./AGENTS.md` first and then `~/.lawt/AGENTS.md`. This lets a project define instructions that apply to its workspace while retaining a personal fallback.

### Provider configuration

The default chat provider is Ollama's local OpenAI-compatible endpoint at `http://localhost:11434/v1` with the API key value `ollama`. To use another provider, create `~/.lawt/provider.ts` and export a default object with a `baseURL` and `apiKey`:

```ts
export default {
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
};
```

The same file can configure the web-search backend. The supported configuration fields are shown below; configure the fields needed by your chosen backend:

```ts
export default {
  baseURL: "https://api.example.com/v1",
  apiKey: "your-api-key",
  webSearch: {
    puppeteer: { chromePath: "default" },
    // Or configure Tavily or Ollama Cloud:
    // tavily: { apiKey: "your-tavily-api-key" },
    // ollama: { apiKey: "your-ollama-cloud-api-key" },
  },
};
```

If either `baseURL` or `apiKey` is missing, LAWT uses its default Ollama chat provider. Web search settings are optional. See the guides for [Ollama](./docs/ollama.md) and [Llama for macOS](./docs/llama.md) for provider-specific setup details.

## Development

The repository includes unit tests and Biome/TypeScript checks. Run these from the project directory:

```bash
npm test
npm run lint
npm run typecheck
```
