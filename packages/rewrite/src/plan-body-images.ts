import { requireProvider } from "@repo/ai";
import type { SiteLanguage } from "@repo/db";
import { generateText, Output } from "ai";
import { z } from "zod";

import { REWRITER_MODEL, SITE_LANGUAGE_HUMAN } from "./prompt-constants";

export const MAX_BODY_IMAGES = 4;

export type PlannedBodyImage = {
  alt: string;
  /** 1-based line of the body the image should be inserted after. */
  line: number;
  prompt: string;
};

export type PlanBodyImagesInput = {
  body: string;
  post: { tags: ReadonlyArray<string>; title: string };
  site: { language: SiteLanguage };
};

const altSchema = z.string().min(1).max(125);
const subjectSchema = z.string().min(10).max(300);

const plannedImageSchema = z.object({
  alt: altSchema,
  line: z.number().int(),
  prompt: subjectSchema,
});

const plannedBodyImagesSchema = z.object({
  images: z.array(plannedImageSchema).max(MAX_BODY_IMAGES),
});

const numberBodyLines = (body: string): string =>
  body
    .split("\n")
    .map((line, i) => `${i + 1}| ${line}`)
    .join("\n");

/**
 * Lines a fenced code block occupies, fences included. Illustrations belong in
 * prose, and an image dropped inside a fence renders as literal text.
 */
const fencedLines = (body: string): ReadonlySet<number> => {
  const fenced = new Set<number>();
  let open = false;
  body.split("\n").forEach((line, i) => {
    if (/^\s*(?:```|~~~)/v.test(line)) {
      open = !open;
      fenced.add(i + 1);
      return;
    }
    if (open) {
      fenced.add(i + 1);
    }
  });
  return fenced;
};

export const buildBodyImagePlanPrompt = (input: PlanBodyImagesInput): string => {
  const languageName = SITE_LANGUAGE_HUMAN[input.site.language];
  const tagHint = input.post.tags.length > 0 ? ` Tags: ${input.post.tags.join(", ")}.` : "";
  return [
    `You are choosing where to place photographs inside a published blog post titled "${input.post.title}".${tagHint}`,
    "",
    "The post body follows, one line per line, each prefixed with `N| ` where N is its line number. The prefix is not part of the text.",
    "",
    numberBodyLines(input.body),
    "",
    `Pick 2 to ${MAX_BODY_IMAGES} spots where a photograph genuinely helps the reader follow the text. A short post gets 2; only a long, section-heavy post gets ${MAX_BODY_IMAGES}. Spread them out: never two images in the same section, and nothing in the first two lines.`,
    "",
    "For each image return:",
    "- `line`: the line number the image is inserted AFTER. Choose the end of a paragraph or a heading line, never a line inside a fenced code block, never a line in the middle of a list.",
    "- `prompt`: in English, one sentence describing the photograph's subject concretely (what is in frame, what is happening). Describe a real scene, not a diagram, chart, infographic, or anything containing text.",
    `- \`alt\`: accessible alt text in ${languageName}, under 125 characters, describing the same photograph for a reader who cannot see it.`,
  ].join("\n");
};

/**
 * The model picks line numbers from a numbered listing, so it can hand back a
 * line that does not exist, repeat one, or land inside a code fence. Everything
 * it returns is filtered against the real body before any image is generated.
 */
export const sanitizeBodyImagePlan = (
  body: string,
  raw: ReadonlyArray<PlannedBodyImage>,
): ReadonlyArray<PlannedBodyImage> => {
  const lineCount = body.split("\n").length;
  const fenced = fencedLines(body);
  const seen = new Set<number>();
  return raw
    .toSorted((a, b) => a.line - b.line)
    .filter((image) => {
      if (!Number.isInteger(image.line) || image.line < 1 || image.line > lineCount) {
        return false;
      }
      if (fenced.has(image.line) || seen.has(image.line)) {
        return false;
      }
      if (image.alt.trim() === "" || image.prompt.trim() === "") {
        return false;
      }
      seen.add(image.line);
      return true;
    })
    .slice(0, MAX_BODY_IMAGES)
    .map((image) => ({ alt: image.alt.trim(), line: image.line, prompt: image.prompt.trim() }));
};

export const planBodyImages = async (
  input: PlanBodyImagesInput,
): Promise<ReadonlyArray<PlannedBodyImage>> => {
  const provider = requireProvider();
  const result = await generateText({
    model: provider(REWRITER_MODEL),
    output: Output.object({ schema: plannedBodyImagesSchema }),
    prompt: buildBodyImagePlanPrompt(input),
  });
  return sanitizeBodyImagePlan(input.body, result.output.images);
};
