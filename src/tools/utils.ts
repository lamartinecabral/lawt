import path from "node:path";
import z from "zod";

export const tool = <T extends z.ZodObject>(params: {
  name: string;
  description: string;
  schema: T;
  execute: (_args: z.infer<T>) => any;
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

export function ok(data) {
  return { success: true, data };
}

export function fail(error) {
  return { success: false, error };
}
