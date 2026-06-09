import { fail, ok, tool } from "./utils.ts";
import { getUrlContent, searchNews } from "./web-search/utils.ts";
import z from "zod";

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
        return fail("Query must be a non-empty string.");
      }

      const results = await searchNews(query);

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

      const { title, content } = await getUrlContent(url);

      return ok([`**TITLE**: ${title}`, `**CONTENT**: ${content}`].join("\n"));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
});

// export const web_search = tool({
//   name: "web_search",
//   description: "Use this tool to retrieve information from the live web.",
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

//       for (const result of results) {
//         try {
//           const { title, content } = await getUrlContent(result.url);

//           if (!contentContainsSnippet(content, result.snippet)) continue;

//           return ok(
//             [
//               `**SOURCE**: ${result.url}`,
//               `**TITLE**: ${title}`,
//               `**CONTENT**: ${content}`,
//             ].join("\n"),
//           );
//         } catch (_) {
//           continue; // If fetching content fails, skip to the next result
//         }
//       }

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
