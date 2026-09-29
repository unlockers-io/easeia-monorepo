import { LinkType } from "@repo/db";

import type { ResolvedLink } from "./classify";

// oxlint-disable-next-line eslint/require-unicode-regexp -- v-mode rejects this class
const escapeRegex = (s: string): string => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

export const fabricatedHrefs = (resolved: ReadonlyArray<ResolvedLink>): Set<string> => {
  const out = new Set<string>();
  for (const link of resolved) {
    if (link.type === LinkType.EXTERNAL) {
      continue;
    }
    // toPostId is null both for an unresolvable slug and for a link the
    // classifier could not attribute to a site at all; both are fabricated.
    if (link.toPostId === null) {
      out.add(link.href);
    }
  }
  return out;
};

/**
 * Remove a single anchor (by exact href) from a body, keeping the anchor text
 * as plain prose. Handles markdown `[text](href)` and html `<a href=…>…</a>`.
 */
export const stripAnchor = (body: string, href: string): string => {
  const h = escapeRegex(href);
  const mdRe = new RegExp(`\\[([^\\]]+)\\]\\(${h}(?:\\s+"[^"]*")?\\)`, "gv");
  let out = body.replace(mdRe, (_full, anchor: string) => anchor);
  const htmlRe = new RegExp(`<a\\s[^>]*href=["']${h}["'][^>]*>([\\s\\S]*?)</a>`, "giv");
  out = out.replace(htmlRe, (_full, inner: string) => inner);
  return out;
};

export const stripAnchors = (body: string, hrefs: Iterable<string>): string => {
  let out = body;
  for (const href of hrefs) {
    out = stripAnchor(out, href);
  }
  return out;
};
