import path from "node:path";
import fs from "node:fs";

/**
 * Resolve a user-supplied path and ensure it stays within the sandbox root.
 * Follows symlinks to block symlink escapes.
 */
export function resolveSandboxed(userPath: string, sandbox: string): string {
  const resolved = path.resolve(sandbox, userPath);
  const normalSandbox = path.resolve(sandbox) + path.sep;
  const normalResolved = path.resolve(resolved);

  if (normalResolved !== path.resolve(sandbox) && !normalResolved.startsWith(normalSandbox)) {
    throw new Error(`Path escapes sandbox: ${userPath}`);
  }

  // If the file already exists, resolve symlinks and re-check
  try {
    const real = fs.realpathSync(normalResolved);
    const realSandbox = fs.realpathSync(path.resolve(sandbox)) + path.sep;
    const realSandboxRoot = fs.realpathSync(path.resolve(sandbox));
    if (real !== realSandboxRoot && !real.startsWith(realSandbox)) {
      throw new Error(`Symlink escapes sandbox: ${userPath}`);
    }
    return real;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist yet — the lexical check above is sufficient
      return normalResolved;
    }
    throw err;
  }
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
  ".pdf",
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
]);

export function isBinaryPath(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Max bytes for read operations (10 MB) */
export const MAX_READ_BYTES = 10 * 1024 * 1024;

/** Max bytes for write operations (10 MB) */
export const MAX_WRITE_BYTES = 10 * 1024 * 1024;
