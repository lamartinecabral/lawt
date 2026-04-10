You are an expert Node.js developer. I want you to autonomously build a full-featured, production-ready CLI AI agent powered by Ollama, complete with linting and End-to-End (E2E) tests. 

Please execute the following steps sequentially. Do not stop until the project is fully implemented, configured, tested, linted, and ready to run.

### Step 1: Project Setup
1. Initialize a new Node.js project. Generate a `package.json` with `"type": "module"`.
2. Install the following dependencies:
   - `ollama`: Official Ollama JavaScript client.
   - `commander`: For parsing CLI arguments.
   - `chalk`: For styling console output.
   - `ora`: For loading spinners.
   - `@inquirer/prompts` (or `readline` built-in): For the interactive chat REPL loop.
3. Install the following `devDependencies`:
   - `eslint` and `@eslint/js`: For code linting.
4. Configure the `package.json` to include:
   - A `"bin"` section pointing to the main CLI entry point (e.g., `"my-agent": "./bin/index.js"`) so it can be installed globally.
   - A `"lint"` script (e.g., `"eslint ."`) to easily run the linter.

### Step 2: Architecture & File Structure
Create the following modular structure:
- `bin/index.js`: The executable entry point. Handles CLI arg parsing with `commander`.
- `src/agent.js`: The core logic for communicating with the Ollama API, managing conversation history, and streaming responses.
- `src/ui.js`: Helper functions for the CLI interface (spinners, formatted text, printing messages).
- `src/config.js`: Default configurations (default model like `llama3` or `mistral`, default system prompt, API host).

### Step 3: Core Features to Implement
1. **Model Management**: Before starting a chat, the agent should check if the requested model exists locally using the Ollama API. If it doesn't, automatically pull the model using a loading spinner to show progress.
2. **Ollama Connection Check**: Implement a try/catch mechanism on startup to verify Ollama is running locally on port 11434. If it is not, print a helpful, user-friendly error message in red and exit gracefully.
3. **Interactive REPL**: Create a continuous chat loop. 
   - Prompt the user for input.
   - Send the input + conversation history to Ollama.
   - **Crucial:** Stream the response back to the terminal token-by-token so the user doesn't have to wait for the entire generation to finish.
   - Save the assistant's response to the conversation history.
   - Allow the user to type `exit`, `quit`, or `/bye` to end the session.
4. **CLI Arguments**: Support the following flags via `commander`:
   - `-m, --model <name>`: Specify the Ollama model to use (default: "llama3").
   - `-s, --system <prompt>`: Provide a custom system prompt to dictate the agent's behavior.
   - `-p, --prompt <text>`: Run in "single-shot" mode. If this flag is passed, the agent should answer the single prompt and exit, rather than entering the interactive loop.

### Step 4: Code Quality, Linting & Error Handling
- Use ES Modules (`import`/`export`) everywhere.
- Use modern `async/await` syntax.
- Ensure all API calls are wrapped in `try/catch` blocks.
- Comment the code clearly, explaining what each function does.
- Create an `eslint.config.js` (Flat Config) or `.eslintrc.json` enforcing standard JavaScript rules (e.g., no unused variables, requiring semicolons or enforcing a consistent style). Ensure the generated code complies with these rules.

### Step 5: End-to-End (E2E) Testing
1. Install testing dependencies as `devDependencies`: 
   - `vitest`: As the test runner.
   - `execa`: To securely execute the CLI command in test files.
   - `nock` (optional, or standard Node.js mocking): To intercept and mock the Ollama local API responses.
2. Create a `tests/` directory and add an `e2e.test.js` file.
3. Implement the following E2E test cases:
   - **Help Output:** Execute the CLI with the `--help` flag and assert that standard commander help text is printed to stdout.
   - **Single-Shot Mode:** Execute the CLI with `-p "test prompt"`. Mock the Ollama API to return a deterministic dummy response, and assert that the CLI successfully prints that exact response to stdout and exits with code `0`.
   - **Graceful Error Handling:** Mock a connection refusal (simulating Ollama being offline) while running the CLI, and assert that the CLI prints your friendly error message to stderr and exits with code `1`.
4. Add a `"test"` script to `package.json` that runs `vitest run`.

### Step 6: Finalization
1. Write a `README.md` explaining how to install the CLI (`npm link`), how to ensure Ollama is running, how to run the E2E tests (`npm test`), how to run the linter (`npm run lint`), and providing examples of how to use the CLI commands.
2. Ensure all files are saved.
3. Autonomously run `npm run lint` and `npm test` in the terminal. If there are any linting errors or failing tests, fix them before completing the task.