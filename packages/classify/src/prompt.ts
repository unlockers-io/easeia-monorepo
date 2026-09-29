import { Niche } from "@repo/db";

type PromptInput = {
  body: string;
  siteDomain: string;
  siteNiches: ReadonlyArray<Niche>;
  title: string;
};

const NICHE_VALUES = Object.values(Niche).join(", ");

export const buildClassifyPrompt = (input: PromptInput): string => {
  const lines = [
    `You are a content taxonomist. Classify a blog post into our internal niche enum + propose long-tail topic tags.`,
    ``,
    `Site: ${input.siteDomain}`,
    `Site's primary niches (hint, not constraint): ${input.siteNiches.join(", ") || "(none set)"}`,
    ``,
    `Constraints:`,
    `- niches: 1-3 values, MUST be drawn from this exact set: ${NICHE_VALUES}`,
    `- tags: 3-8 lowercase phrases (2-50 chars, ascii letters/digits/spaces/hyphens only). Each tag must be a specific topic (e.g., "tuscany destination weddings"), not a generic niche (e.g., "wedding"). Tags that duplicate a niche enum value will be discarded.`,
    `- Match the language of the post title for tag values.`,
    `- No emojis. No marketing fluff.`,
    ``,
    `Post title: ${input.title}`,
    ``,
    `Post body:`,
    input.body,
  ];
  return lines.join("\n");
};
