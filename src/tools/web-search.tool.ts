import { fail, ok, tool } from "./utils.ts";
import puppeteer from "puppeteer-core";
import z from "zod";

const BRAVE_SEARCH_URL = "https://search.brave.com";
const MAX_RESULTS = 5;
const SEARCH_TIMEOUT_MS = 25000;
const CHROME_PATH: string = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  linux: "/usr/bin/google-chrome",
}[process.platform];

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
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
        results
          .map((result) =>
            [
              `**title**: ${result.title}`,
              `**url**: ${result.url}`,
              `**snippet**: ${result.snippet}`,
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
    executablePath: CHROME_PATH,
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
