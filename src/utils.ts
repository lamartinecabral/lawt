import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import readline from "node:readline/promises";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export const abortables = new Set<{ abort: () => any }>();

rl.on("close", () => {
  for (const abortable of abortables) abortable.abort();
  console.log(pc.dim("\nGoodbye!"));
  process.exit(0);
});

export const question = () => {
  return rl.question("");
};

export const finish = () => {
  rl.close();
};

export const ellipsis = (str = "", len = 50) => {
  if (str.length > len) return str.substring(0, len - 1) + "…";
  return str;
};

export const projectRoot = path.resolve(
  path.dirname(fs.realpathSync(process.argv[1])),
  "..",
);
