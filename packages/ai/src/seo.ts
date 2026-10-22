import {
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  SEO_TITLE_MIN,
} from "@repo/health";
import { z } from "zod";

import { generateStructured } from "./client";

const seoSuggestionSchema = z.object({
  description: z.string().min(SEO_DESCRIPTION_MIN).max(SEO_DESCRIPTION_MAX),
  focusKeyword: z.string().min(2).max(80),
  rationale: z.string().min(20).max(400),
  title: z.string().min(SEO_TITLE_MIN).max(SEO_TITLE_MAX),
});

export type SeoSuggestion = z.infer<typeof seoSuggestionSchema>;

export type SeoSuggestionInput = {
  bodyText: string;
  currentDescription?: string;
  currentFocusKeyword?: string;
  currentTitle?: string;
  excerpt?: string;
  locale?: string;
  postTitle: string;
  siteDomain: string;
};

const MAX_BODY_CHARS = 6000;

const buildPrompt = (input: SeoSuggestionInput): string => {
  const body = input.bodyText.slice(0, MAX_BODY_CHARS);

  const lines = [
    `You are an SEO copywriter. Rewrite the SEO metadata for a blog post on ${input.siteDomain}.`,
    `Locale: ${input.locale ?? "auto-detect from content"}.`,
    "",
    "Constraints:",
    `- SEO title: 50-${SEO_TITLE_MAX} characters, include focus keyword near the start, no quotes.`,
    `- Meta description: 140-${SEO_DESCRIPTION_MAX} characters, active voice, ends with a verb-driven hook.`,
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
