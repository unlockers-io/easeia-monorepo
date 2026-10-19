/// <reference lib="dom" />

import { gfm } from "@truto/turndown-plugin-gfm";
import TurndownService from "turndown";

const GUTENBERG = /<!--\s*\/?wp:/v;

const BLOCK_TAGS =
  "p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|figure|figcaption|section|article|blockquote|main|header|footer|nav|aside";

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
  td.use(gfm);

  td.addRule("figure", {
    filter: "figure",
    replacement: (content, node) => {
      const img = node.querySelector("img");
      if (!img) {
        return `\n\n${content}\n\n`;
      }
      const captionEl = node.querySelector("figcaption");
      const src = img.getAttribute("src") ?? "";
      const alt = img.getAttribute("alt") ?? "";
      const caption = captionEl?.textContent.trim() ?? "";
      const imgMd = `![${alt}](${src})`;
      return caption ? `${imgMd}\n\n*${caption}*` : imgMd;
    },
  });

  return td;
};

const turndown = buildTurndown();

const MARKDOWN_LINK = /\[(?<text>[^\]\n]+)\]\((?<url>https?:\/\/[^\)\s]+)\)/gv;

const escapeAttribute = (url: string): string =>
  url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

const htmlToMarkdown = (html: string): string =>
  turndown
    .turndown(
      html.replaceAll(
        MARKDOWN_LINK,
        (_link, text: string, url: string) => `<a href="${escapeAttribute(url)}">${text}</a>`,
      ),
    )
    .trim();

export const toMarkdown = (raw: string): string => {
  if (GUTENBERG.test(raw)) {
    return htmlToMarkdown(stripGutenbergFences(raw));
  }
  if (!HTML_STRUCTURE.test(raw)) {
    return raw;
  }
  if (MARKDOWN_BLOCK.test(raw) && raw.includes("\n\n")) {
    return raw;
  }
  return htmlToMarkdown(raw);
};
