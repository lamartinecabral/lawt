import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import z from "zod";
import { fail, getResolvedPath, ok, tool } from "./utils.ts";

export const grep_search = tool({
  name: "grep_search",
  description:
    "Do a fast text search in the workspace. Use this tool when you want to search with an exact string or regex. If you are not sure what words will appear in the workspace, prefer using regex patterns with alternation (|) or character classes to search for multiple potential words at once instead of making separate searches. For example, use 'function|method|procedure' to look for all of those words at once. Use includePattern to search within files matching a specific pattern, or in a specific file, using a relative path.",
  schema: z.object({
    query: z.string(
      "The pattern to search for in files in the workspace. Use regex with alternation (e.g., 'word1|word2|word3') or character classes to find multiple potential words in a single search. Be sure to set the isRegexp property properly to declare whether it's a regex or plain text pattern. Is case-insensitive.",
    ),
    isRegexp: z.boolean().describe("Whether the pattern is a regex."),
    includePattern: z
      .string()
      .optional()
      .describe(
        'Search files matching this glob pattern. Will be applied to the relative path of files within the workspace. To search recursively inside a folder, use a proper glob pattern like "src/folder/**". Do not use | in includePattern.',
      ),
    maxResults: z
      .number()
      .optional()
      .describe(
        "The maximum number of results to return. Do not use this unless necessary, it can slow things down. By default, only some matches are returned. If you use this and don't see what you're looking for, you can try again with a more specific query or a larger maxResults.",
      ),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return fail("Query must be a non-empty string.");
      }

      const maxResults = args.maxResults;
      if (
        maxResults !== undefined &&
        (!Number.isInteger(maxResults) || maxResults < 1)
      ) {
        return fail("maxResults must be a positive integer.");
      }

      let pattern: RegExp;
      try {
        pattern = new RegExp(args.isRegexp ? query : escapeRegExp(query), "i");
      } catch (err) {
        return fail(
          `Invalid search pattern: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const files = await getSearchFiles(args.includePattern);
      const results: { file: string; line: number; text: string }[] = [];

      for (const file of files) {
        try {
          const fullPath = getResolvedPath(file);
          const content = await fs.readFile(fullPath, "utf-8");
          const lines = content.split(/\r\n|\r|\n/);

          for (let index = 0; index < lines.length; index += 1) {
            const lineText = lines[index] ?? "";
            if (!pattern.test(lineText)) {
              continue;
            }

            results.push({
              file,
              line: index + 1,
              text: lineText.trim(),
            });

            if (maxResults !== undefined && results.length >= maxResults) {
              return ok(parseResults(results));
            }
          }
        } catch {
          // Skip unreadable files and continue searching the workspace.
        }
      }

      return ok(parseResults(results));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

function parseResults(results: { file: string; line: number; text: string }[]) {
  return results
    .map((result) => `${result.file}:${result.line}:${result.text}`)
    .join("\n");
}

function normalizeSearchPattern(query) {
  if (path.isAbsolute(query)) {
    const globIndex = findGlobIndex(query);

    if (globIndex === -1) {
      const resolved = getResolvedPath(query);
      return path.relative(process.cwd(), resolved);
    }

    const prefix = query.slice(0, globIndex);
    const remainder = query.slice(globIndex);
    const absolutePrefix = path.resolve(prefix);
    const relativePrefix = path.relative(process.cwd(), absolutePrefix);

    if (relativePrefix.startsWith("..")) {
      throw new Error("Search pattern must remain inside the workspace.");
    }

    const normalizedPrefix = relativePrefix.split(path.sep).join("/");
    return normalizedPrefix ? `${normalizedPrefix}/${remainder}` : remainder;
  }

  const globIndex = findGlobIndex(query);
  const prefix = globIndex === -1 ? query : query.slice(0, globIndex);
  const normalizedPrefix = path.normalize(prefix);

  if (normalizedPrefix.startsWith("..") || path.isAbsolute(normalizedPrefix)) {
    throw new Error("Search pattern must remain inside the workspace.");
  }

  return query;
}

function findGlobIndex(pattern) {
  const special = /[*?[\]{}()]/;
  const match = pattern.match(special);
  return match ? match.index : -1;
}

async function getSearchFiles(includePattern) {
  const query = String(includePattern ?? "**/*").trim() || "**/*";

  if (findGlobIndex(query) === -1) {
    try {
      const resolvedPath = getResolvedPath(query);
      const stats = await fs.stat(resolvedPath);
      const relativePath = path
        .relative(process.cwd(), resolvedPath)
        .split(path.sep)
        .join("/");

      if (stats.isFile()) {
        return [relativePath];
      }

      if (stats.isDirectory()) {
        const directoryPattern = relativePath ? `${relativePath}/**/*` : "**/*";
        return await fg(directoryPattern, {
          cwd: process.cwd(),
          onlyFiles: true,
          dot: true,
          unique: true,
        });
      }
    } catch (err) {
      if (!(err instanceof Error && err["code"] === "ENOENT")) {
        throw err;
      }
    }
  }

  const normalizedPattern = normalizeSearchPattern(query);
  return await fg(normalizedPattern, {
    cwd: process.cwd(),
    onlyFiles: true,
    dot: true,
    unique: true,
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
