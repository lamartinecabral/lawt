You are an expert Node.js developer. I want you to autonomously build a full-featured, production-ready CLI AI agent powered by Ollama. 

Please execute the following steps sequentially. Do not stop until the project is fully implemented, configured, and ready to run.

### Step 1: Project Setup
1. Initialize a new Node.js project. Generate a `package.json` with `"type": "module"`.
2. Install the following dependencies:
   - `ollama`: Official Ollama JavaScript client.
   - `commander`: For parsing CLI arguments.
   - `chalk`: For styling console output.
   - `ora`: For loading spinners.
   - `@inquirer/prompts` (or `readline` built-in): For the interactive chat REPL loop.
3. Configure the `package.json` to include a `"bin"` section pointing to the main CLI entry point (e.g., `"my-agent": "./bin/index.js"`) so it can be installed globally.

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

### Step 4: Code Quality & Error Handling
- Use ES Modules (`import`/`export`) everywhere.
- Use modern `async/await` syntax.
- Ensure all API calls are wrapped in `try/catch` blocks.
- Comment the code clearly, explaining what each function does.

### Step 5: Finalization
1. Write a `README.md` explaining how to install the CLI (`npm link`), how to ensure Ollama is running, and providing examples of how to use the CLI commands.
2. Ensure all files are saved and run a basic syntax check on your generated code.

Please proceed to build this project now.