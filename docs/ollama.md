# Running lawt With Ollama

This guide covers the extra Ollama setup that makes `lawt` workable for longer, tool-using sessions.

## Why this matters

Agentic workflows keep a lot more state than a simple chat prompt. Two Ollama defaults are usually too small for that:

- the default context length is often too short for tool-heavy sessions
- the default model keepalive is too short, so the model may unload between requests

For `lawt`, adjust both before you rely on Ollama for longer runs.

## 1. Increase Ollama context length

In the Ollama app, open Settings and move the context length slider to a larger value.

Recommended starting point:

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

Example for a 30 minute keepalive:

```bash
ollama run gemma4:latest --keepalive=30m ""
```

After that, start `lawt` normally:

```bash
lawt -m gemma4:latest
```

Notes:

- replace `gemma4:latest` with the model you actually use
- higher keepalive values keep RAM or VRAM reserved for longer
- to unload the model manually later, run `ollama stop gemma4:latest`

## Troubleshooting

- If the model unloads mid-session, increase `keepalive` or use `-1`.
- If the model runs out of memory, reduce context length or use a smaller model.
- If responses get truncated or the agent loses earlier state, increase context length further.
