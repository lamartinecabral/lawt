// @ts-check
import { Ollama } from "ollama";
import pc from "picocolors";
import readline from "node:readline/promises";

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/** @type {Set<{abort: () => any}>} */
export const abortables = new Set();

rl.on("close", () => {
  for (const abortable of abortables) abortable.abort();
  console.log(pc.dim("\nGood bye!"));
  process.exit(0);
});

export const finish = () => {
  rl.close();
};

export const ellipsis = (str = "", len = 50) => {
  if (str.length > len) return str.substring(0, len - 1) + "…";
  return str;
};

export const ollama = new Ollama();
