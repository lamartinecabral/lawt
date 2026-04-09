import { loadEnv } from './env';
import { runCli } from './cli';

try {
  loadEnv();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Environment error: ${message}`);
  process.exit(1);
}

runCli().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
