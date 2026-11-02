# Running lawt With Ollama

This guide explains how to configure Ollama as `lawt`'s provider and adjust Ollama for longer, tool-using sessions.

## Configure lawt to use Ollama

Llama is `lawt`'s default provider. To use Ollama, create `~/.lawt/provider.ts` with Ollama's local OpenAI-compatible endpoint:

```ts
export default {
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
};
```

Ollama's local server does not require an API key; `lawt` needs a non-empty value for its OpenAI client, so `ollama` can be any string. If Ollama runs on another machine, replace `localhost` with that machine's address.

Install or pull a model, then list the models Ollama provides and start a session with the chosen model ID:

```bash
ollama pull <model>
lawt list
lawt -m <model-id>
```

The configuration file overrides the default provider for both `lawt` and `lawt list`.

## Why this matters

Agentic workflows keep a lot more state than a simple chat prompt. Two Ollama defaults are usually too small for that:

- the default context length is often too short for tool-heavy sessions
- the default model keepalive is too short, so the model may unload between requests

For `lawt`, adjust both before you rely on Ollama for longer runs. Ollama's
current defaults are selected based on available VRAM for context length and
five minutes for model keepalive.

## 1. Increase Ollama context length

In the Ollama app, open Settings and move the context length slider to a larger value.

Recommended starting point for agentic workflows:

- use at least `64000` tokens for agentic workflows

Notes:

- a larger context uses more RAM or VRAM
- if your hardware cannot support `64000`, use the largest stable value available
- you can confirm the loaded context with `ollama ps`

Example:

```bash
ollama ps
```

If you cannot change this in the app, Ollama also supports setting a server-wide default when starting the server:

```bash
OLLAMA_CONTEXT_LENGTH=64000 ollama serve
```

## 2. Preload the model with a longer keepalive

Ollama unloads idle models after a short default keepalive window, which is too aggressive for `lawt`. Preload the model manually with a higher `keep_alive` value before starting the CLI.

Example for a 30-minute keepalive using the CLI:

```bash
ollama run <model> --keepalive=30m ""
```

Alternatively, set the server-wide default before starting Ollama:

```bash
OLLAMA_KEEP_ALIVE=30m ollama serve
```

After that, start `lawt` normally:

```bash
lawt -m <model>
```

Notes:

- replace `<model>` with the model you actually use
- higher keepalive values keep RAM or VRAM reserved for longer
- to unload the model manually later, run `ollama stop <model>`

## Troubleshooting

- If the model unloads mid-session, increase `keepalive` or use `-1`.
- If the model runs out of memory, reduce context length or use a smaller model.
- If responses get truncated or the agent loses earlier state, increase context length further.
