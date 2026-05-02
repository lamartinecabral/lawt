import { finish, projectRoot } from "../../utils.ts";
import { Command } from "commander";
import { configDotenv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import pc from "picocolors";
import pkg from "../../../package.json" with { type: "json" };
import { run } from "./run.ts";
import { toolsToGoogleFormat } from "../../tools/index.ts";
import z from "zod";

const program = new Command();

const ai = new GoogleGenAI({
  apiKey: getApiKey(),
});

const model = "models/gemma-4-31b-it";

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, "-v, --version")
  .option("-p, --prompt <prompt>", "Initial prompt")
  .option(
    "-s, --system <value>",
    "System prompt",
    "You are an assistant with access to tools.",
  )
  .action(async function () {
    const opts = optsSchema.parse(this.opts());

    console.log(pc.bgGreen(`${this.name()} - ${this.description()}`));
    showOpts(opts);

    const chat = await ai.chats.create({
      model,
      config: {
        systemInstruction: opts.system,
        tools: [{ functionDeclarations: toolsToGoogleFormat() }],
      },
    });

    if (opts.prompt) {
      await run({
        chat,
        userPrompt: opts.prompt,
      });
    }

    while (true) {
      const res = await run({
        chat,
        interceptUserPrompt: (prompt) => {
          if (prompt === "/exit") return true;
          return false;
        },
      });

      if (res === "/exit") break;
    }

    finish();
  });

async function showOpts(opts: z.infer<typeof optsSchema>) {
  const { system } = opts;
  console.log(``);
  let maxLen = 0;
  [
    ["model", model],
    ["system prompt", system],
  ]
    .map((a) => {
      maxLen = Math.max(maxLen, String(a[0]).length);
      return a;
    })
    .forEach(([a, b]) =>
      console.log(`${a}:`.padEnd(maxLen + 1, " "), pc.dim(String(b))),
    );
}

const optsSchema = z.object({
  prompt: z.string().nonempty().optional(),
  system: z.string().nonempty(),
});

function getApiKey() {
  configDotenv({
    quiet: true,
    path: projectRoot + "/.env",
  });

  if (!process.env.GEMINI_API_KEY)
    throw new Error("GEMINI_API_KEY is required");

  return process.env.GEMINI_API_KEY;
}
// START

program.parse();
