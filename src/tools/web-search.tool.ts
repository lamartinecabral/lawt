import { chromePath, fail, ok, tool } from "./utils.ts";
import { getUrlContent } from "./fetch-url.tool.ts";
import puppeteer from "puppeteer-core";
import z from "zod";

const BRAVE_SEARCH_URL = "https://search.brave.com";
const MAX_RESULTS = 5;
const SEARCH_TIMEOUT_MS = 25000;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export const web_search = tool({
  name: "web_search",
  description: "Searches the web for information based on a query.",
  schema: z.object({
    query: z
      .string()
      .describe("The search terms or question to find information about."),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return fail("Query must be a non-empty string.");
      }

      const results = await searchWeb(query);

      for (const result of results) {
        const content = await getUrlContent(result.url);
        if (contentContainsSnippet(content, result.snippet)) {
          return ok(
            [`**URL**: ${result.url}`, `**Content**:\n${content}`].join("\n"),
          );
        }
      }

      return ok(
        results
          .map((result) =>
            [
              `**Title**: ${result.title}`,
              `**URL**: ${result.url}`,
              `**Snippet**: ${result.snippet}`,
            ].join("\n"),
          )
          .join("\n\n"),
      );
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

async function searchWeb(query: string) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();

    await page.goto(
      `${BRAVE_SEARCH_URL}/search?q=${encodeURIComponent(query)}`,
      {
        waitUntil: "domcontentloaded",
        timeout: SEARCH_TIMEOUT_MS,
      },
    );

    await page.waitForFunction(
      () => {
        const browserDocument = (globalThis as any).document;
        const main = browserDocument?.querySelector?.("main");
        if (!main) return false;

        const hasResults =
          main.querySelector(
            "article, [data-type='web'], .snippet, .result, a[href^='http']",
          ) !== null;
        const noResults = /no results|did not match any documents/i.test(
          main.textContent ?? "",
        );

        return hasResults || noResults;
      },
      { timeout: SEARCH_TIMEOUT_MS },
    );

    const results = await page.evaluate((maxResults) => {
      const cleanText = (value: string | null | undefined) =>
        (value ?? "").replace(/\s+/g, " ").trim();
      const browserDocument = (globalThis as any).document;

      const parsedResults: SearchResult[] = [];

      const snippets = browserDocument.querySelectorAll(
        "main .snippet[data-type='web']",
      );

      for (const snippet of snippets) {
        const url = snippet.querySelector?.("a[href^='http']").href;
        const title = snippet.querySelector?.(
          "a[href^='http'] .title",
        ).innerText;

        let text = "";
        const content = snippet.querySelector?.(".content");
        if (content) {
          text = content.innerText;
          const when = content.querySelector?.(".t-secondary")?.innerText;
          if (when) text = text.replace(when, "");
        }

        parsedResults.push({
          title: title,
          url: url,
          snippet: cleanText(text),
        });

        if (parsedResults.length >= maxResults) break;
      }

      return parsedResults;
    }, MAX_RESULTS);

    if (!results.length) {
      return [];
    }

    return results;
  } finally {
    await browser.close();
  }
}

const contentContainsSnippet = (content: string, snippet: string) => {
  if (!snippet) return true;
  const a = snippet.toLowerCase();
  const m = a.length;
  for (let i = 0; i < content.length; i += m) {
    const chunk = content.slice(i, i + m * 2);
    if (chunk.length < m) break;
    const b = chunk.toLowerCase();
    const n = b.length;
    // dp[i][j] = LCS length of a[0..i-1] and b[0..j-1]
    const dp: number[] = new Array(n + 1).fill(0);
    let prev;
    for (let i = 1; i <= m; i++) {
      prev = 0;
      for (let j = 1; j <= n; j++) {
        const temp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
        prev = temp;
      }
    }
    if (dp[n] / m >= 0.6) return true;
  }
  return false;
};
