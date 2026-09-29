import { parseHTML } from "linkedom";

export type PageContent = {
  bodyText: string;
  metaDescription: string | null;
  title: string | null;
};

/**
 * One parse per page. `crawlPage` used to build its own DOM for `<title>` and
 * the meta description and then call `extractVisibleText`, which parsed the same
 * HTML a second time; DOM construction is the dominant CPU cost per crawled page.
 */
export const extractPageContent = (html: string): PageContent => {
  const { document } = parseHTML(html);

  // Read head metadata before pruning, so additions to the selector list below
  // cannot start removing it.
  const title = document.querySelector("title")?.textContent.trim() ?? null;
  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? null;

  for (const selector of ["script", "style", "nav", "header", "footer", "aside", "noscript"]) {
    for (const el of document.querySelectorAll(selector)) {
      el.remove();
    }
  }
  const buckets: Array<string> = [];
  for (const el of document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, td, dd")) {
    const text = el.textContent.replaceAll(/\s+/gv, " ").trim();
    if (text) {
      buckets.push(text);
    }
  }
  return { bodyText: buckets.join("\n\n"), metaDescription, title };
};

export const extractVisibleText = (html: string): string => extractPageContent(html).bodyText;
