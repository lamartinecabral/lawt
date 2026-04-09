import fs from 'fs/promises';
import path from 'path';

export interface RepositoryFile {
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
}

export interface RepositoryContext {
  root: string;
  ignorePatterns: string[];
  files: RepositoryFile[];
}

const DEFAULT_IGNORES = ['.git', 'node_modules', 'dist', 'out', 'coverage'];

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function isIgnored(relativePath: string, ignorePatterns: string[]): boolean {
  const normalized = normalizeRelativePath(relativePath);
  for (const pattern of [...DEFAULT_IGNORES, ...ignorePatterns]) {
    const normalizedPattern = normalizeRelativePath(pattern);
    if (
      normalized === normalizedPattern ||
      normalized.startsWith(`${normalizedPattern}/`) ||
      normalized.includes(`/${normalizedPattern}/`) ||
      normalized.endsWith(`/${normalizedPattern}`)
    ) {
      return true;
    }
  }
  return false;
}

export function resolveRepositoryPath(root: string, filePath: string): string {
  const absoluteRoot = path.resolve(root);
  const resolvedPath = path.resolve(absoluteRoot, filePath);

  if (resolvedPath !== absoluteRoot && !resolvedPath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`Path is outside of the repository workspace: ${filePath}`);
  }

  return resolvedPath;
}

async function scanDirectory(
  root: string,
  directory: string,
  ignorePatterns: string[],
  files: RepositoryFile[],
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const relativePath = normalizeRelativePath(path.relative(root, entryPath));

    if (isIgnored(relativePath, ignorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      await scanDirectory(root, entryPath, ignorePatterns, files);
      continue;
    }

    if (entry.isFile()) {
      const stat = await fs.stat(entryPath);
      files.push({
        path: entryPath,
        relativePath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }
}

export async function buildRepositoryContext(
  root: string,
  ignorePatterns: string[] = [],
): Promise<RepositoryContext> {
  const absoluteRoot = path.resolve(root);
  const files: RepositoryFile[] = [];
  await scanDirectory(absoluteRoot, absoluteRoot, ignorePatterns, files);

  return {
    root: absoluteRoot,
    ignorePatterns,
    files,
  };
}

export async function readWorkspaceFile(root: string, relativePath: string): Promise<string> {
  const absolutePath = resolveRepositoryPath(root, relativePath);
  return fs.readFile(absolutePath, 'utf8');
}

export async function searchWorkspace(
  root: string,
  query: string,
  ignorePatterns: string[] = [],
): Promise<Array<{ path: string; snippets: string[] }>> {
  const context = await buildRepositoryContext(root, ignorePatterns);
  const results: Array<{ path: string; snippets: string[] }> = [];
  const lowerQuery = query.toLowerCase();

  await Promise.all(
    context.files.map(async (file) => {
      if (file.size > 256_000) {
        return;
      }

      const content = await fs.readFile(file.path, 'utf8');
      const lines = content.split(/\r?\n/);
      const snippets: string[] = [];

      for (let index = 0; index < lines.length; index++) {
        if (lines[index].toLowerCase().includes(lowerQuery)) {
          snippets.push(`${index + 1}: ${lines[index].trim()}`);
          if (snippets.length >= 5) {
            break;
          }
        }
      }

      if (snippets.length > 0) {
        results.push({ path: file.relativePath, snippets });
      }
    }),
  );

  return results;
}
