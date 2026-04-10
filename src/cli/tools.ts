import { ALL_TOOLS, toolsToOllamaFormat } from "../tools/index.js";
import pc from "picocolors";
import { z } from "zod";

export function toolsCommand(json: boolean): void {
  if (json) {
    const schemas = toolsToOllamaFormat();
    console.log(JSON.stringify(schemas, null, 2));
  } else {
    console.log(pc.bold("Available tools:\n"));
    for (const tool of ALL_TOOLS) {
      console.log(`  ${pc.cyan(tool.name)}`);
      console.log(`    ${tool.description}`);
      if (tool.schema instanceof z.ZodObject) {
        const keys = Object.keys(tool.schema.shape as Record<string, unknown>);
        console.log(`    Params: ${keys.join(", ")}`);
      }
      console.log();
    }
  }
}
