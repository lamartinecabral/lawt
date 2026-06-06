import { ellipsis } from "../utils.ts";
import path from "node:path";
import { spawn } from "node:child_process";
import z from "zod";

export const tool = <T extends z.ZodObject>(params: {
  name: string;
  description: string;
  schema: T;
  execute: (
    _args: z.infer<T>,
  ) => Promise<ReturnType<typeof fail> | ReturnType<typeof ok>>;
}) => params;

export function getResolvedPath(unresolvedPath = "") {
  const requestedPath = unresolvedPath || ".";
  const resolvedPath = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(process.cwd(), requestedPath);

  const relative = path.relative(process.cwd(), resolvedPath);
  if (relative.startsWith("..")) {
    throw new Error(`Path is outside the workspace: ${unresolvedPath}`);
  }
  return resolvedPath;
}

export function ok(data: string) {
  return { success: true as const, data: truncate(data, 5000) };
}

export function fail(error: string) {
  return { success: false as const, error };
}

export function runCommand(command: string, args: string[] = []) {
  return new Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: true,
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code, signal) => {
      resolve({ stdout, stderr, code, signal });
    });
  });
}

const truncate = (str = "", len = 300) => {
  if (str.length > len) {
    return `${ellipsis(str, len)} ${str.length - len} chars truncated`;
  }
  return str;
};
