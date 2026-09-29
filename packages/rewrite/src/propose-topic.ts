import { generateStructured } from "@repo/ai";
import type { Niche, SiteLanguage } from "@repo/db";
import { z } from "zod";

import { SITE_LANGUAGE_HUMAN } from "./prompt-constants";

const proposedTopicSchema = z.object({
  angle: z.string().min(10).max(300),
  focusKeyword: z.string().min(2).max(80),
});

export type ProposedTopic = z.infer<typeof proposedTopicSchema>;

export type ProposeTopicInput = {
  language: SiteLanguage;
  niches: ReadonlyArray<Niche>;
  recentTitles: ReadonlyArray<string>;
  searchQueries: ReadonlyArray<string>;
  topicHints: string | null;
};

const buildProposeTopicPrompt = (input: ProposeTopicInput): string => {
  const languageName = SITE_LANGUAGE_HUMAN[input.language];
  const niches = input.niches.length === 0 ? "unspecified" : input.niches.join(", ");
  const lines = [
    "You pick the next blog post topic for a niche site. Choose ONE focus keyword a real person would type into Google, plus the angle the post should take.",
    `Site niches: ${niches}.`,
    input.topicHints !== null && input.topicHints !== ""
      ? `Editorial guidance from the site owner: ${input.topicHints}`
      : "",
    input.searchQueries.length > 0
      ? [
          "QUERIES THE SITE ALREADY GETS IMPRESSIONS FOR (from Google Search Console; strong candidates because demand is proven):",
          ...input.searchQueries.map((q) => `  - ${q}`),
        ].join("\n")
      : "",
    input.recentTitles.length > 0
      ? [
          "RECENTLY PUBLISHED ON THIS SITE (do not repeat these topics or close variants):",
          ...input.recentTitles.map((t) => `  - ${t}`),
        ].join("\n")
      : "",
    "Rules:",
    "- Prefer a specific long-tail keyword (3-6 words) over a broad head term.",
    "- If a Search Console query above fits the niches and is not already covered by a recent title, prefer it.",
    "- The angle must be one sentence describing what the post will say that a generic overview would not.",
    `- Write focusKeyword and angle in ${languageName}.`,
    "Output JSON with: focusKeyword, angle.",
  ];
  return lines.filter((l) => l !== "").join("\n");
};

const proposeTopic = (input: ProposeTopicInput): Promise<ProposedTopic> =>
  generateStructured({
    prompt: buildProposeTopicPrompt(input),
    schema: proposedTopicSchema,
  });

export { buildProposeTopicPrompt, proposeTopic };
