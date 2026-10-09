import type { SiteLanguage } from "@repo/db";

import { dedupeBody } from "./dedupe-body";
import { stripEmDash } from "./strip-em-dash";
import { toMarkdown } from "./to-markdown";

const CONTROL_CHARACTERS = /[[\p{Cc}--[\t\n\r]]\p{Cs}\p{Noncharacter_Code_Point}]/gv;

export const normalizeBody = (raw: string, language: SiteLanguage): string => {
  const markdown = toMarkdown(raw.replaceAll(CONTROL_CHARACTERS, ""));
  return stripEmDash(dedupeBody(markdown), language, "markdown").text;
};
