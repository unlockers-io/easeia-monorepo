import { z } from "zod";

import { generateStructured } from "./generate";

// Keep in sync with @repo/health SEO_* (Ahrefs Site Audit character bars).
const seoSuggestionSchema = z.object({
  description: z.string().min(70).max(160),
  focusKeyword: z.string().min(2).max(80),
  rationale: z.string().min(20).max(400),
  title: z.string().min(30).max(60),
});

export type SeoSuggestion = z.infer<typeof seoSuggestionSchema>;

export type SeoSuggestionInput = {
  currentDescription?: string;
  currentFocusKeyword?: string;
  currentTitle?: string;
  excerpt?: string;
  htmlContent: string;
  locale?: string;
  postTitle: string;
  siteDomain: string;
};

const stripHtml = (html: string): string =>
  html
    .replaceAll(/<!--[\s\S]*?-->/gv, "")
    .replaceAll(/<[^>]+>/gv, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll(/\s+/gv, " ")
    .trim();

const MAX_BODY_CHARS = 6000;

const buildPrompt = (input: SeoSuggestionInput): string => {
  const body = stripHtml(input.htmlContent).slice(0, MAX_BODY_CHARS);
  const lines = [
    `You are an SEO copywriter. Rewrite the SEO metadata for a blog post on ${input.siteDomain}.`,
    `Locale: ${input.locale ?? "auto-detect from content"}.`,
    "",
    "Constraints:",
    "- SEO title: 50-60 characters, include focus keyword near the start, no quotes.",
    "- Meta description: 140-160 characters, active voice, ends with a verb-driven hook.",
    "- Focus keyword: 2-5 words, the search term you'd target.",
    "- Match the language of the post.",
    "- No emojis. No marketing fluff. No 'discover', 'unlock', 'unleash'.",
    "",
    `Post title: ${input.postTitle}`,
  ];
  if (input.excerpt !== undefined && input.excerpt !== "") {
    lines.push(`Excerpt: ${input.excerpt}`);
  }
  if (input.currentTitle !== undefined && input.currentTitle !== "") {
    lines.push(`Current SEO title: ${input.currentTitle}`);
  }
  if (input.currentDescription !== undefined && input.currentDescription !== "") {
    lines.push(`Current meta description: ${input.currentDescription}`);
  }
  if (input.currentFocusKeyword !== undefined && input.currentFocusKeyword !== "") {
    lines.push(`Current focus keyword: ${input.currentFocusKeyword}`);
  }
  lines.push("", "Post body:", body);
  return lines.join("\n");
};

export const generateSeoSuggestions = (input: SeoSuggestionInput): Promise<SeoSuggestion> => {
  return generateStructured({ prompt: buildPrompt(input), schema: seoSuggestionSchema });
};

export { seoSuggestionSchema };
