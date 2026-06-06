import { chromePath, fail, ok, tool } from "./utils.ts";
import puppeteer from "puppeteer-core";
import z from "zod";

const FETCH_TIMEOUT_MS = 25000;

export const fetch_url = tool({
  name: "fetch_url",
  description: "Fetches the text content of a given URL.",
  schema: z.object({
    url: z.string().describe("The full URL of the web page to fetch."),
  }),
  async execute(args) {
    try {
      const url = String(args.url ?? "").trim();
      if (!url) {
        return fail("URL must be a non-empty string.");
      }

      const content = await getUrlContent(url);
      return ok(content);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

async function getUrlContent(url: string) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: FETCH_TIMEOUT_MS,
    });

    const content = await page.evaluate(() => {
      const body = (globalThis as any).document.body;

      return body?.innerText.trim() || undefined;
    });

    if (!content) {
      throw new Error("Could not extract content from the page.");
    }

    return content;
  } finally {
    await browser.close();
  }
}
