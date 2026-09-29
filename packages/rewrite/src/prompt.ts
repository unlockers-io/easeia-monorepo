import type { Niche, SiteLanguage } from "@repo/db";

import { REWRITER_SYSTEM_PROMPT, SITE_LANGUAGE_HUMAN } from "./prompt-constants";

const MAX_BODY_CHARS = 8000;

export type AnchorSpec = {
  anchor: string;
  reason: string;
  url: string;
};

export type RewritePromptInput = {
  anchors: ReadonlyArray<AnchorSpec>;
  moneySiteName: string | null;
  post: {
    body: string;
    excerpt: string | null;
    focusKeyword: string | null;
    niches: ReadonlyArray<Niche>;
    tags: ReadonlyArray<string>;
    title: string;
  };
  siteDomain: string;
  siteLanguage: SiteLanguage;
  siteNiches: ReadonlyArray<Niche>;
};

export const buildRewritePrompt = (input: RewritePromptInput): string => {
  const languageName = SITE_LANGUAGE_HUMAN[input.siteLanguage];
  const lines = [
    REWRITER_SYSTEM_PROMPT,
    "",
    `Task: rewrite the blog post below for the site ${input.siteDomain}.`,
    `LANGUAGE: write everything (title, body, excerpt, focusKeyword) in ${languageName}, whatever language the original is in. If the original is in another language, translate it.`,
    input.moneySiteName !== null && input.moneySiteName !== ""
      ? `This site is part of a network that promotes ${input.moneySiteName}. Treat ${input.moneySiteName} links as the highest-value outbound destination.`
      : "",
    "Apply ALL of the rules above (voice, anti-AI, SEO, copywriting).",
    "",
    'You MUST insert each of these links as <a href="URL">anchor</a> tags somewhere in the rewritten body, at a natural location relevant to the surrounding text. Do not bunch them together; spread them across the post.',
    "",
    ...input.anchors.map(
      (a, i) => `Link ${i + 1}: ${a.url} (anchor "${a.anchor}", context: ${a.reason})`,
    ),
    "",
    `Original title: ${input.post.title}`,
    `Original excerpt: ${input.post.excerpt ?? "(none)"}`,
    `Current focus keyword: ${input.post.focusKeyword ?? "(none)"}`,
    `Niches: ${input.post.niches.join(", ")}`,
    `Tags: ${input.post.tags.slice(0, 8).join(", ")}`,
    "",
    `Output structured JSON with: title (50-60 chars, in ${languageName}), body (HTML in ${languageName}), excerpt (140-160 chars, in ${languageName}), focusKeyword (2-5 words, in ${languageName}).`,
    "Preserve all WordPress Gutenberg block-comment markup (`<!-- wp:* -->` / `<!-- /wp:* -->`) if present in the original: output the new body in the same block structure.",
    "",
    "Original body:",
    input.post.body.slice(0, MAX_BODY_CHARS),
  ];
  return lines.filter((line) => line !== "").join("\n");
};
