import readline from "node:readline";
import { abortables } from "./utils.ts";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.emitKeypressEvents(process.stdin, rl);

export const question = async () => {
  const read = () => {
    return new Promise<string>((resolve) => rl.question("", resolve));
  };

  const line = await read();

  if (line.trim() === '"""') {
    const lines: string[] = [];
    while (true) {
      const nextLine = await read();
      if (nextLine.trim() === '"""') break;
      lines.push(nextLine);
    }

    return lines.join("\n");
  }

  return line;
};

const abort = () => {
  for (const abortable of abortables) abortable.abort();
};

export const finish = () => {
  abort();
  rl.close();
};

process.stdin.on("keypress", (_str, key) => {
  if (key.ctrl && key.name === "c") {
    finish();
  }
  if (key.name === "escape") {
    abort();
  }
});
