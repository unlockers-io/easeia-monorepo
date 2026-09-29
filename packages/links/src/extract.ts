import { parseHTML } from "linkedom";

export type ExtractedLink = {
  anchorText: string;
  href: string;
  position: number;
  rel: string | null;
};

// We are matching the dangerous prefix, not constructing one.
// eslint-disable-next-line no-script-url -- detection list, not a literal href
const SKIP_PREFIXES = ["#", "mailto:", "tel:", "javascript:"];

export const extractFromHtml = (html: string): Array<ExtractedLink> => {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const anchors = document.querySelectorAll("a[href]");
  const out: Array<ExtractedLink> = [];
  let position = 0;
  for (const a of anchors) {
    const href = a.getAttribute("href")?.trim();
    if (href === undefined || href === "") {
      continue;
    }
    if (SKIP_PREFIXES.some((p) => href.startsWith(p))) {
      continue;
    }
    out.push({
      anchorText: a.textContent.trim(),
      href,
      position: position++,
      rel: a.getAttribute("rel"),
    });
  }
  return out;
};
