import { generateStructured } from "@repo/ai";
import { Niche, prisma } from "@repo/db";
import { z } from "zod";

import { buildClassifyPrompt } from "./prompt";

const MAX_BODY_CHARS = 8000;
const NICHE_VALUES = new Set<string>(Object.values(Niche));

const schema = z.object({
  niches: z.array(z.enum(Niche)).min(1).max(3),
  tags: z
    .array(
      z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9 \u002D]+$/iv, "tags must be ascii letters/digits/spaces/hyphens"),
    )
    .min(3)
    .max(8),
});

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

export const normalizeTag = (raw: string): string => raw.toLowerCase().trim();

const matchesNicheEnum = (tag: string): boolean =>
  NICHE_VALUES.has(tag.toUpperCase().replaceAll(/[ \u002D]/gv, "_"));

export const mergeTags = (
  existing: ReadonlyArray<string>,
  fresh: ReadonlyArray<string>,
): Array<string> => {
  const seen = new Set<string>();
  const out: Array<string> = [];
  for (const t of existing) {
    const n = normalizeTag(t);
    if (!seen.has(n) && !matchesNicheEnum(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  for (const t of fresh) {
    const n = normalizeTag(t);
    if (!seen.has(n) && !matchesNicheEnum(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
};

export type ClassifyContentInput = {
  body: string;
  siteDomain: string;
  siteNiches: ReadonlyArray<Niche>;
  title: string;
};

export type ClassifyContentResult = {
  niches: Array<Niche>;
  tags: Array<string>;
};

export const classifyContent = async (
  input: ClassifyContentInput,
): Promise<ClassifyContentResult> => {
  const body = stripHtml(input.body).slice(0, MAX_BODY_CHARS);
  const prompt = buildClassifyPrompt({
    body,
    siteDomain: input.siteDomain,
    siteNiches: input.siteNiches,
    title: input.title,
  });
  const output = await generateStructured({ prompt, schema });
  return { niches: output.niches, tags: output.tags };
};

export const classifyPost = async (postId: string): Promise<void> => {
  const post = await prisma.post.findUnique({
    include: { site: { select: { domain: true, niches: true } } },
    where: { id: postId },
  });
  if (!post) {
    return;
  }
  const result = await classifyContent({
    body: post.body,
    siteDomain: post.site.domain,
    siteNiches: post.site.niches,
    title: post.title,
  });
  const mergedTags = mergeTags(post.tags, result.tags);
  await prisma.post.update({
    data: { niches: result.niches, tags: mergedTags },
    where: { id: postId },
  });
};
