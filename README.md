# minicode

CLI AI agent powered by Ollama for file operations and multi-step tasks.

## Prerequisites

- **Node.js 22+**
- **Ollama** running locally (or specify a remote host)

## Install

```bash
npm install
npm run build
npm link
```

## Ollama Setup

1. Install Ollama: https://ollama.com/download
2. Start the server:
   ```bash
   ollama serve
   ```
3. Pull a model (minicode will auto-pull if missing):
   ```bash
   ollama pull gpt-oss:20b
   ```

## Usage

### Interactive Chat

```bash
minicode chat
minicode --model llama3.1:8b chat
```

### Autonomous Run

```bash
minicode run "Create a hello.ts file that exports a greet function"
minicode --verbose run "Refactor utils.ts to use async/await"
minicode --json run "List all TypeScript files"
```

### List Tools

```bash
minicode tools
minicode --json tools
```

### Global Options

| Option          | Default                    | Description                |
|-----------------|----------------------------|----------------------------|
| `--model`       | `gpt-oss:20b`             | Ollama model               |
| `--host`        | `http://127.0.0.1:11434`  | Ollama server URL          |
| `--cwd`         | Current directory          | Sandbox working directory  |
| `--max-steps`   | `20`                       | Max autonomous loop steps  |
| `--json`        | `false`                    | JSON output                |
| `--verbose`     | `false`                    | Detailed step logs         |

## Safety Model

All file operations are sandboxed to `--cwd`:

- Path traversal (`../`) is blocked
- Symlink escapes are detected and rejected
- Binary files are rejected for text operations
- File size limits enforced (10 MB read/write)
- Every tool returns structured success/error payloads

## Available Tools

| Tool              | Description                              |
|-------------------|------------------------------------------|
| `list_dir`        | List directory contents                  |
| `read_file`       | Read file with optional line range       |
| `write_file`      | Write file, create dirs as needed        |
| `append_file`     | Append content to file                   |
| `replace_in_file` | Search and replace in file               |
| `delete_file`     | Delete a file                            |
| `move_file`       | Move or rename a file                    |
| `mkdir`           | Create directory                         |
| `glob_search`     | Find files by glob pattern               |
| `grep_search`     | Search file contents                     |

## Development

```bash
npm run dev -- chat                  # Dev mode chat
npm run dev -- run "task"            # Dev mode run
npm run lint                         # ESLint
npm run lint:fix                     # ESLint with auto-fix
npm run typecheck                    # TypeScript type check
npm run test                         # Unit tests
npm run test:e2e                     # E2E tests
npm run check                        # All checks (lint + typecheck + test + e2e)
npm run build                        # Production build
```

## License

MIT
