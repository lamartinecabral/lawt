import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    setupFiles: ['tests/setup.ts'],
    env: {
      OPENAI_API_KEY: 'sk-test-dummy-key',
      OPENAI_BASE_URL: 'https://api.openai.com'
    },
  },
});
