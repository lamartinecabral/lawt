import { fail, ok, tool } from "./utils.ts";
import puppeteer from "puppeteer-core";
import z from "zod";

const BRAVE_SEARCH_URL = "https://search.brave.com";
const MAX_RESULTS = 5;
const SEARCH_TIMEOUT_MS = 5000;

type SearchResult = {
  title: string;
  url: string;
  description: string;
};

export const web_search = tool({
  name: "web_search",
  description:
    "Use this tool to perform a web search for up-to-date information.",
  schema: z.object({
    query: z.string().describe("The search query."),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return fail("Query must be a non-empty string.");
      }

      const results = await searchWeb(query);
      return ok(
        JSON.stringify(
          {
            query,
            results,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

async function searchWeb(query: string) {
  const browser = await puppeteer.launch({
    // google chrome executable path for macOS
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
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

      const selectors = [
        "main article",
        "main [data-type='web']",
        "main .snippet",
        "main .result",
      ];

      const seenUrls = new Set<string>();
      const parsedResults: SearchResult[] = [];
      const containers = selectors.flatMap((selector) =>
        Array.from(browserDocument?.querySelectorAll?.(selector) ?? []),
      ) as any[];

      for (const container of containers) {
        const link = container.querySelector?.("a[href^='http']");
        const url = cleanText(link?.href);
        if (!url || seenUrls.has(url)) {
          continue;
        }

        const title =
          cleanText(
            container.querySelector?.("h1, h2, h3, .title, [data-type='title']")
              ?.textContent,
          ) || cleanText(link?.textContent);

        const description = cleanText(
          container.querySelector?.(".content")?.textContent,
        );

        if (!title) {
          continue;
        }

        seenUrls.add(url);
        parsedResults.push({
          title,
          url,
          description,
        });

        if (parsedResults.length === maxResults) {
          return parsedResults;
        }
      }

      const fallbackLinks = Array.from(
        browserDocument?.querySelectorAll?.("main a[href^='http']") ?? [],
      ) as any[];

      for (const link of fallbackLinks) {
        const url = cleanText(link.href);
        const title = cleanText(link.textContent);
        if (!url || !title || seenUrls.has(url)) {
          continue;
        }

        const container = link.closest?.("article, li, div");
        const description = cleanText(container?.textContent)
          .replace(title, "")
          .trim();

        seenUrls.add(url);
        parsedResults.push({
          title,
          url,
          description,
        });

        if (parsedResults.length === maxResults) {
          break;
        }
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
