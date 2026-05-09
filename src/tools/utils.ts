import path from "node:path";
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
  return { success: true as const, data };
}

export function fail(error: string) {
  return { success: false as const, error };
}
