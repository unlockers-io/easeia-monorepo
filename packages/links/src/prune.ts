import { LinkType } from "@repo/db";

import type { ResolvedLink } from "./classify";

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

export const stripLinks = (markdown: string, hrefs: Iterable<string>): string => {
  let out = markdown;

  for (const href of hrefs) {
    const link = new RegExp(`\\[([^\\]]+)\\]\\(${RegExp.escape(href)}(?:\\s+"[^"]*")?\\)`, "gv");

    out = out.replace(link, (_full, text: string) => text);
  }

  return out;
};
