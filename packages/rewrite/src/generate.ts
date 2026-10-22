import type { Niche, SiteLanguage } from "@repo/db";
import {
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  SEO_TITLE_MIN,
} from "@repo/health";
import { stripHtml } from "@repo/posts";
import { franc } from "franc";
import { z } from "zod";

import { generateWithAnchors } from "./anchored-generation";
import type { AnchorSpec } from "./prompt";
import { REWRITER_SYSTEM_PROMPT, SITE_LANGUAGE_HUMAN } from "./prompt-constants";

const kebabCase = (raw: string): string =>
  raw
    .normalize("NFD")
    .replaceAll(/\p{M}/gv, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gv, "-")
    .replaceAll(/^-+|-+$/gv, "");

type FrancToSiteLanguageContract = Record<string, SiteLanguage>;

const FRANC_TO_SITE_LANGUAGE = {
  eng: "EN",
  por: "PT",
  spa: "ES",
} satisfies FrancToSiteLanguageContract;

const francToSiteLanguage = new Map<string, SiteLanguage>(Object.entries(FRANC_TO_SITE_LANGUAGE));

export class LanguageMismatchError extends Error {
  override readonly name = "LanguageMismatchError";

  constructor(
    public readonly expected: SiteLanguage,
    public readonly detected: SiteLanguage | "unknown",
    public readonly francCode: string,
  ) {
    super(
      `Generated body language ${detected} (${francCode}) does not match site language ${expected}`,
    );
  }
}

const generatedPostSchema = z.object({
  body: z.string().min(200),
  category: z.string().min(2).max(40),
  excerpt: z.string().min(SEO_DESCRIPTION_MIN).max(SEO_DESCRIPTION_MAX),
  focusKeyword: z.string().min(2).max(80),
  tags: z.array(z.string().min(1).max(40)).min(1).max(8),
  title: z.string().min(SEO_TITLE_MIN).max(SEO_TITLE_MAX),
});

export type GeneratedPost = {
  body: string;
  category: string;
  excerpt: string;
  focusKeyword: string;
  slug: string;
  tags: ReadonlyArray<string>;
  title: string;
};

export type SerpCompetitor = {
  description: string | null;
  title: string;
};

export type SerpContext = {
  competitors: ReadonlyArray<SerpCompetitor>;
  focusKeyword: string;
};

export type GeneratePostInput = {
  anchors: ReadonlyArray<AnchorSpec>;
  serpContext: SerpContext | null;
  site: {
    domain: string;
    language: SiteLanguage;
    moneySiteName: string | null;
    niches: ReadonlyArray<Niche>;
  };
  topicHints: string | null;
};

const buildAnchorsSection = (anchors: ReadonlyArray<AnchorSpec>): string => {
  if (anchors.length === 0) {
    return "";
  }

  const lines = anchors.map(
    (a, i) => `  ${i + 1}. ${a.url}\n     anchor text: "${a.anchor}"\n     reason: ${a.reason}`,
  );

  return [
    'LINKS TO INSERT (each exactly once, as inline `<a href="…">anchor text</a>` tags at natural spots in the body):',
    ...lines,
  ].join("\n");
};

const buildSerpSection = (serp: SerpContext): string => {
  const lines = serp.competitors.map((c, i) => {
    const description = c.description === null || c.description === "" ? "" : `: ${c.description}`;

    return `  ${i + 1}. ${c.title}${description}`;
  });

  return [
    `TARGET FOCUS KEYWORD: "${serp.focusKeyword}". Use it as the post's focusKeyword and build the post around this search intent.`,
    "",
    "ALREADY RANKING (current top Google results for this keyword):",
    ...lines,
    "",
    "DIFFERENTIATION REQUIREMENTS:",
    "- The post must contain substantial information the results above do not cover: a missing angle, a step they skip, a trade-off they ignore, or more concrete specifics than they give. A rephrased consensus of these results is a failure.",
    "- Do not imitate their titles. Pick a title that signals the angle they lack.",
    "- Where the ranking results agree on something, state it briefly and move on; spend the word count on what they leave out.",
  ].join("\n");
};

const buildGeneratePrompt = (input: GeneratePostInput): string => {
  const niches = input.site.niches.length === 0 ? "unspecified" : input.site.niches.join(", ");
  const languageName = SITE_LANGUAGE_HUMAN[input.site.language];
  const anchorsSection = buildAnchorsSection(input.anchors);
  const serpSection = input.serpContext === null ? "" : buildSerpSection(input.serpContext);

  const lines = [
    REWRITER_SYSTEM_PROMPT,
    "",
    `Task: write a brand-new blog post for the WordPress site ${input.site.domain}.`,
    `Site niches: ${niches}.`,
    input.topicHints !== null && input.topicHints !== ""
      ? `Topic guidance: ${input.topicHints}`
      : "Pick a fresh angle within the site's niches.",
    input.site.moneySiteName !== null && input.site.moneySiteName !== ""
      ? `This site is part of a network that promotes ${input.site.moneySiteName}.`
      : "",
    "",
    serpSection,
    serpSection === "" ? "" : "",
    anchorsSection,
    anchorsSection === "" ? "" : "",
    `LANGUAGE: write everything (title, body, excerpt, focusKeyword, tags) in ${languageName}. Do not output any other language. Do not translate to English.`,
    "Apply ALL of the rules above (voice, anti-AI, SEO, copywriting, copy-editing).",
    "",
    `Output structured JSON with: title (50-${SEO_TITLE_MAX} chars, in ${languageName}), body (Markdown in ${languageName}; use ## / ### headings, **bold**, _italics_, - bullet lists; put each heading, paragraph and list item on its own line separated by a blank line; the only raw HTML allowed is the inline <a href="…"> tags for the links listed above, never HTML block markup and never Gutenberg block comments), category (one Title-Case noun phrase in ${languageName} naming the post's primary section, e.g. "Iluminação" or "Edição de Vídeo"), excerpt (140-${SEO_DESCRIPTION_MAX} chars, in ${languageName}), focusKeyword (2-5 words, in ${languageName}), tags (1-8 lowercase short strings in ${languageName}).`,
  ];

  return lines.filter((l) => l !== "").join("\n");
};

type DetectedLanguage = { detected: SiteLanguage | "unknown"; francCode: string };

const detectBodyLanguage = (body: string): DetectedLanguage => {
  const code = franc(stripHtml(body), { only: ["eng", "por", "spa"] });

  if (code === "und") {
    return { detected: "unknown", francCode: code };
  }

  const detected = francToSiteLanguage.get(code);

  return detected ? { detected, francCode: code } : { detected: "unknown", francCode: code };
};

export const generateNewPost = async (input: GeneratePostInput): Promise<GeneratedPost> => {
  const {
    output: { body, category, excerpt, focusKeyword, tags, title },
  } = await generateWithAnchors({
    anchors: input.anchors,
    insertInstruction:
      'Insert each one inline at a natural spot in the body as <a href="URL">anchor</a>, leaving the rest of the body as Markdown with its blank-line paragraph breaks intact.',
    prompt: buildGeneratePrompt(input),
    schema: generatedPostSchema,
  });

  const { detected, francCode } = detectBodyLanguage(body);

  if (detected !== input.site.language) {
    throw new LanguageMismatchError(input.site.language, detected, francCode);
  }

  return {
    body,
    category,
    excerpt,
    focusKeyword,
    slug: kebabCase(title),
    tags,
    title,
  };
};

export { buildGeneratePrompt };
