import { extractContent } from "@lamartinecabral/extract-content";
import type { Page } from "puppeteer-core";
import puppeteer from "puppeteer-core";

export const chromePath: string =
  process.env.CHROME_PATH ||
  {
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    linux: "/usr/bin/google-chrome",
  }[process.platform];

const BRAVE_SEARCH_URL = "https://search.brave.com";
const WEB_TIMEOUT_MS = 25000;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export async function urlContent(url: string) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();
    return await getUrlContent(page, url);
  } finally {
    await browser.close();
  }
}

export async function fullSearchWeb(query: string) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();

    const allResults: (SearchResult & { content?: string })[] = [];

    for (const getResults of [getSearchWebResults, getSearchNewsResults]) {
      const results: typeof allResults = await getResults(page, query);
      allResults.push(...results.slice(0, 10));
    }

    return allResults;
  } finally {
    await browser.close();
  }
}

async function getSearchWebResults(page: Page, query: string) {
  await page.goto(`${BRAVE_SEARCH_URL}/search?q=${encodeURIComponent(query)}`, {
    waitUntil: "domcontentloaded",
    timeout: WEB_TIMEOUT_MS,
  });

  await page.waitForFunction(
    () => {
      const browserDocument = globalThis.document;
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
    { timeout: WEB_TIMEOUT_MS },
  );

  const results = await page.evaluate((maxResults) => {
    const cleanText = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const browserDocument = globalThis.document;

    const parsedResults: SearchResult[] = [];

    const snippets = browserDocument.querySelectorAll(
      "main .snippet[data-type='web']",
    );

    for (const snippet of snippets) {
      const url = snippet.querySelector?.("a[href^='http']").href;
      const title = snippet.querySelector?.("a[href^='http'] .title").innerText;

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
  }, 10);

  if (!results.length) {
    return [];
  }

  return results;
}

async function getSearchNewsResults(page: Page, query: string) {
  await page.goto(
    `${BRAVE_SEARCH_URL}/news?spellcheck=0&q=${encodeURIComponent(query)}`,
    {
      waitUntil: "domcontentloaded",
      timeout: WEB_TIMEOUT_MS,
    },
  );

  await page.waitForFunction(
    () => {
      const browserDocument = globalThis.document;
      const main = browserDocument?.querySelector?.("main");
      if (!main) return false;

      const hasResults =
        main.querySelector(
          `article, [data-type='news'], .snippet, .result, a[href^='http']`,
        ) !== null;
      const noResults = /no results|did not match any documents/i.test(
        main.textContent ?? "",
      );

      return hasResults || noResults;
    },
    { timeout: WEB_TIMEOUT_MS },
  );

  const results = await page.evaluate((maxResults) => {
    const cleanText = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const browserDocument = globalThis.document;

    const parsedResults: SearchResult[] = [];

    const snippets = browserDocument.querySelectorAll(
      `main .snippet[data-type='news']`,
    );

    for (const snippet of snippets) {
      const url = snippet.querySelector?.("a[href^='http']").href;
      const title = snippet.querySelector?.("a[href^='http'] .title").innerText;

      let text = "";
      const content = snippet.querySelector?.(".content");
      if (content) {
        const description = content.querySelector(".description")?.innerText;
        const age = content.querySelector(".age-snippet")?.innerText;
        text = cleanText(`${age} - ${description}`);
      }

      parsedResults.push({
        title: title,
        url: url,
        snippet: text,
      });

      if (parsedResults.length >= maxResults) break;
    }

    return parsedResults;
  }, 10);

  if (!results.length) {
    return [];
  }

  return results;
}

export async function getUrlContent(
  page: Page,
  url: string,
): Promise<{ title: string; content: string }> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: WEB_TIMEOUT_MS,
  });

  await page.waitForFunction(
    () => {
      const browserDocument = globalThis.document;
      const hasContent = browserDocument?.body?.innerText.trim().length > 0;
      return hasContent;
    },
    { timeout: WEB_TIMEOUT_MS },
  );

  const { title, content } = await page.evaluate(extractContent);

  if (!content) {
    throw new Error("Could not extract content from the page.");
  }

  return { title, content };
}
