import { getWebSearchClient } from "@lamartinecabral/web-search";
import z from "zod";
import { getProvider } from "../utils.ts";
import { fail, ok, tool } from "./utils.ts";

export const getClient = async () => {
  const provider = await getProvider();
  return await getWebSearchClient({
    ollama: { apiKey: provider.webSearch?.ollama?.apiKey },
    tavily: { apiKey: provider.webSearch?.tavily?.apiKey },
    local: { chromePath: provider.webSearch?.local?.chromePath }
  });
};

export const web_search = tool({
  name: "web_search",
  description:
    "Search the live web for current events, news, or general real-time information.",
  schema: z.object({
    query: z.string().describe("The specific search query to execute."),
  }),
  async execute(args) {
    try {
      const query = String(args.query ?? "").trim();
      if (!query) {
        throw new Error("Query must be a non-empty string.");
      }

      const client = await getClient();
      const results = await client.webSearch(query);

      const formatted = results
        .map((result) =>
          [
            `**TITLE**: ${result.title}`,
            `**URL**: ${result.url}`,
            `**SNIPPET**: ${result.snippet}`,
          ].join("\n"),
        )
        .join("\n\n");

      return ok(formatted || "No results found.");
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

export const fetch_page_content = tool({
  name: "fetch_page_content",
  description:
    "Extract and parse the raw text content from a specific live website URL.",
  schema: z.object({
    url: z
      .string()
      .describe("The exact HTTP or HTTPS URL of the web page to scrape."),
  }),
  async execute(args) {
    try {
      const url = String(args.url ?? "").trim();
      if (!url) {
        return fail("URL must be a non-empty string.");
      }

      const client = await getClient();
      const { title, content } = await client.webFetch(url);

      return ok([`**TITLE**: ${title}`, `**CONTENT**:`, content].join("\n"));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});
