import { chromePath, fail, ok, tool } from "./utils.ts";
import puppeteer from "puppeteer-core";
import z from "zod";

const BRAVE_SEARCH_URL = "https://search.brave.com";
const MAX_RESULTS = 10;
const WEB_TIMEOUT_MS = 25000;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

// export const web_search = tool({
//   name: "web_search",
//   description:
//     "Use this tool to retrieve information snippets from the live web.",
//   schema: z.object({
//     query: z.string().describe("The search terms or question."),
//   }),
//   async execute(args) {
//     try {
//       const query = String(args.query ?? "").trim();
//       if (!query) {
//         return fail("Query must be a non-empty string.");
//       }

//       const results = await searchWeb(query);

//       return ok(
//         results
//           .map((result) =>
//             [
//               `**SOURCE**: ${result.url}`,
//               `**TITLE**: ${result.title}`,
//               `**SNIPPET**: ${result.snippet}`,
//             ].join("\n"),
//           )
//           .join("\n\n"),
//       );
//     } catch (err) {
//       return fail(err instanceof Error ? err.message : String(err));
//     }
//   },
// });

// export const fetch_url = tool({
//   name: "fetch_url",
//   description: "Use this tool to retrieve information from a source URL.",
//   schema: z.object({
//     url: z.string().describe("The full URL of the source."),
//   }),
//   async execute(args) {
//     try {
//       const url = String(args.url ?? "").trim();
//       if (!url) {
//         return fail("URL must be a non-empty string.");
//       }

//       const { title, content } = await getUrlContent(url);

//       return ok([`**TITLE**: ${title}`, `**CONTENT**: ${content}`].join("\n"));
//     } catch (err) {
//       return fail(err instanceof Error ? err.message : String(err));
//     }
//   },
// });

export const web_search = tool({
  name: "web_search",
  description: "Use this tool to retrieve information from the live web.",
  schema: z.object({
    query: z.string().describe("The search terms or question."),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return fail("Query must be a non-empty string.");
      }

      const results = await searchWeb(query);

      for (const result of results) {
        const { title, content } = await getUrlContent(result.url);

        if (!contentContainsSnippet(content, result.snippet)) continue;

        return ok(
          [
            `**SOURCE**: ${result.url}`,
            `**TITLE**: ${title}`,
            `**CONTENT**: ${content}`,
          ].join("\n"),
        );
      }

      return ok(
        results
          .map((result) =>
            [
              `**SOURCE**: ${result.url}`,
              `**TITLE**: ${result.title}`,
              `**SNIPPET**: ${result.snippet}`,
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
        timeout: WEB_TIMEOUT_MS,
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
      { timeout: WEB_TIMEOUT_MS },
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

export async function getUrlContent(
  url: string,
): Promise<{ title: string; content: string }> {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: WEB_TIMEOUT_MS,
    });

    const [title, content] = await page.evaluate(() => {
      const browserDocument = (globalThis as any).document;

      let text = browserDocument.body?.innerText.trim();
      const title = browserDocument.title?.trim();

      const selectors = [
        "body main",
        "body article",
        "body #content",
        "body .content",
        "body .main",
      ];

      for (const selector of selectors) {
        const elem = browserDocument.querySelector(selector);
        if (!elem) continue;
        const elemText = elem.innerText.trim() ?? "";
        if (elemText.length / text.length > 0.5) {
          text = elemText;
          break;
        }
      }

      return [title, text];
    });

    if (!content) {
      throw new Error("Could not extract content from the page.");
    }

    return { title, content };
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
