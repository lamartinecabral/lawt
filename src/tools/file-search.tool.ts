import path from "node:path";
import fg from "fast-glob";
import z from "zod";
import { fail, getResolvedPath, ok, tool } from "./utils.ts";

export const file_search = tool({
  name: "file_search",
  description:
    "Search for files in the workspace by glob pattern. This only returns the paths of matching files. Use this tool when you know the exact filename pattern of the files you're searching for. Glob patterns match from the root of the workspace folder. Examples:\n- **/*.{js,ts} to match all js/ts files in the workspace.\n- src/** to match all files under the top-level src folder.\n- **/foo/**/*.js to match all js files under any foo folder in the workspace.\n\nIn a multi-root workspace, you can scope the search to a specific workspace folder by using the absolute path to the folder as the query, e.g. /path/to/folder/**/*.ts.",
  schema: z.object({
    query: z
      .string()
      .describe(
        "Search for files with names or paths matching this glob pattern. Can also be an absolute path to a workspace folder to scope the search in a multi-root workspace.",
      ),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return fail("Query must be a non-empty string.");
      }

      const normalizedPattern = normalizeSearchPattern(query);
      const matches = await fg(normalizedPattern, {
        cwd: process.cwd(),
        onlyFiles: true,
        dot: true,
        unique: true,
      });

      return ok(matches.sort((a, b) => a.localeCompare(b)).join("\n"));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

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
