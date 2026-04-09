#!/usr/bin/env node

try {
  require('./dist/index.js');
} catch (error) {
  console.error('Missing build artifacts. Run `npm run build` first.');
  process.exit(1);
}
