import TurndownService from "turndown";

const GUTENBERG = /<!--\s*\/?wp:/v;

const BLOCK_TAGS =
  "p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|figure|figcaption|section|article|blockquote|main|header|footer|nav|aside";

// generator embeds its anchors as `<a href="…">…</a>`, and CommonMark renders
// raw inline HTML as-is), so a generic `</[a-zA-Z]` test would hand a Markdown
// body to Turndown, which escapes its `*`/`#` and collapses every line break
// into one unreadable block. Markdown autolinks (`<https://…>`) and stray `<`
// in prose match nothing here either.
const HTML_STRUCTURE = new RegExp(`</(?:${BLOCK_TAGS})\\s*>|<(?:${BLOCK_TAGS})[\\s\\/>]`, "iv");

const MARKDOWN_BLOCK = /^(?:#{1,6} |[\-*] |\d+\. )/mv;

const stripGutenbergFences = (html: string): string =>
  html.replaceAll(/<!--\s*\/?wp:[^>]*?-->/gv, "");

const buildTurndown = (): TurndownService => {
  const td = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
    fence: "```",
    headingStyle: "atx",
    hr: "---",
    linkStyle: "inlined",
    strongDelimiter: "**",
  });

  td.addRule("figure", {
    filter: "figure",
    replacement: (_content, node) => {
      // SAFETY: Turndown passes parsed DOM elements here, but its Node type omits querySelector.
      // oxlint-disable-next-line no-unsafe-type-assertion, anti-slop/no-chained-type-assertions -- Turndown's Node type omits the DOM methods its runtime elements carry
      const el = node as unknown as {
        querySelector: (sel: string) => null | {
          getAttribute: (name: string) => string | null;
          textContent?: string;
        };
      };
      const img = el.querySelector("img");
      const captionEl = el.querySelector("figcaption");
      const src = img?.getAttribute("src") ?? "";
      const alt = img?.getAttribute("alt") ?? "";
      const caption = captionEl?.textContent?.trim() ?? "";
      const imgMd = `![${alt}](${src})`;
      return caption ? `${imgMd}\n\n*${caption}*` : imgMd;
    },
  });

  return td;
};

const turndown = buildTurndown();

export const normalizeBody = (raw: string): string => {
  if (GUTENBERG.test(raw)) {
    return turndown.turndown(stripGutenbergFences(raw)).trim();
  }
  if (!HTML_STRUCTURE.test(raw)) {
    return raw;
  }
  if (MARKDOWN_BLOCK.test(raw) && raw.includes("\n\n")) {
    return raw;
  }
  return turndown.turndown(raw).trim();
};
