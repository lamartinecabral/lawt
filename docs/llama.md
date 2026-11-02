# Running lawt with Llama

Llama is the default provider for `lawt`. It is a macOS menu bar app that runs local models and provides an OpenAI-compatible API. Start Llama and install a model; `lawt` connects to its local API at `http://localhost:9931/v1` with no additional provider configuration.

## Connect lawt

1. Install and launch [Llama](https://github.com/ggml-org/Llama-macOS). Install a model in the app and start its server.
2. List the models Llama serves, then start `lawt` with the model ID shown:

   ```bash
   lawt list
   lawt -m <model-id>
   ```

The server starts with Llama and listens on `http://localhost:9931/v1` by default. `lawt` supplies the API key value `llama.app`; the local server does not require an API key. The app loads a model when requested and unloads it after its idle timeout.

## Set a longer context

A larger context gives `lawt` more room for conversation history and tool results, but uses more memory. Start with `64000` tokens if your Mac can run the model reliably, or use a smaller value if memory is limited.

Llama chooses settings for each model based on your Mac. To override the context size, add the model's exact ID from `lawt list` to `~/.config/llama/models.user.ini`:

```ini
[model-id]
ctx-size = 65536
```

Replace `model-id` with the full model ID, including its organization, repository, and quantization suffix if present. Llama merges this file with its generated model settings.

## Keep the model loaded

In Llama's settings, increase the timeout in **Unload when idle** if the model unloads during pauses between requests. A longer timeout keeps more memory reserved for the model. You can leave the default if the reload time is acceptable.

## Troubleshooting

- If `lawt list` cannot connect, make sure Llama is running and `baseURL` is `http://localhost:9931/v1`.
- If the model does not appear, install it in Llama and check the exact ID with `lawt list`.
- If the model runs out of memory, lower `ctx-size` or use a smaller model.
- If the model loses earlier conversation details, raise `ctx-size` if your Mac has enough memory.
- Tool use depends on the model's chat template and tool-calling support; try a model that supports tools if it only replies with text.

See the [Llama documentation](https://github.com/ggml-org/Llama-macOS/blob/main/readme.md) for installation, model configuration, and server details.
