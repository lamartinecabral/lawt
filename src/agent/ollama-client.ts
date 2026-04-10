import { Ollama } from "ollama";
import pc from "picocolors";
import { getLogger } from "../lib/logger.js";

export interface OllamaClientOptions {
  host: string;
  model: string;
}

export async function createOllamaClient(opts: OllamaClientOptions): Promise<Ollama> {
  const log = getLogger();
  const client = new Ollama({ host: opts.host });

  // Verify connectivity
  try {
    await client.list();
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.message.includes("ECONNREFUSED")
        ? `Cannot connect to Ollama at ${opts.host}. Is Ollama running?\n  → Start it with: ollama serve`
        : `Failed to connect to Ollama at ${opts.host}: ${err instanceof Error ? err.message : String(err)}`;
    throw new Error(msg, { cause: err });
  }

  // Check model availability
  const models = await client.list();
  const available = models.models.some(
    (m) => m.name === opts.model || m.name === `${opts.model}:latest`,
  );

  if (!available) {
    console.log(pc.yellow(`Model ${opts.model} not found locally. Pulling...`));
    try {
      const stream = await client.pull({ model: opts.model, stream: true });
      for await (const progress of stream) {
        if (progress.total && progress.completed) {
          const pct = Math.round((progress.completed / progress.total) * 100);
          process.stdout.write(`\r  Pulling: ${pct}%`);
        }
      }
      console.log(pc.green("\n  Pull complete."));
    } catch (pullErr: unknown) {
      throw new Error(
        `Failed to pull model ${opts.model}: ${pullErr instanceof Error ? pullErr.message : String(pullErr)}`,
        { cause: pullErr },
      );
    }
  }

  log.debug("Ollama client ready with model %s", opts.model);
  return client;
}
