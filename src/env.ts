import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

export function loadEnv() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const EnvSchema = z
    .object({
      OPENAI_BASE_URL: z.string().url().optional(),
      OPENAI_API_KEY: z.string().optional(),
    })
    .refine(
      (env) => {
        if (env.OPENAI_BASE_URL || env.OPENAI_API_KEY) {
          return Boolean(env.OPENAI_BASE_URL) && Boolean(env.OPENAI_API_KEY);
        }
        return true;
      },
      { message: 'Both OPENAI_BASE_URL and OPENAI_API_KEY must be set together' },
    );

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return {
    provider: {
      openai: {
        baseUrl: result.data.OPENAI_BASE_URL,
        apiKey: result.data.OPENAI_API_KEY,
      },
    },
  };
}
