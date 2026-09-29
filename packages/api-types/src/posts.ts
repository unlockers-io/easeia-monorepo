import { Niche, PostStatus } from "@repo/db/browser";
import { z } from "zod";

const niches = z.array(z.enum(Niche)).default([]);

export const postCreateSchema = z.object({
  body: z.string().min(1),
  categories: z.array(z.string()).default([]),
  excerpt: z.string().max(300).optional(),
  focusKeyword: z.string().max(80).optional(),
  niches,
  publish: z.boolean().default(false),
  scheduledAt: z.coerce.date().optional(),
  siteId: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/v, "kebab-case lowercase only"),
  tags: z.array(z.string()).default([]),
  title: z.string().min(1).max(160),
});

export const postUpdateSchema = postCreateSchema.partial().extend({
  status: z.enum(PostStatus).optional(),
});

export const postListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  niche: z.enum(Niche).optional(),
  q: z.string().optional(),
  siteId: z.string().optional(),
  status: z.enum(PostStatus).optional(),
});

export type PostCreate = z.infer<typeof postCreateSchema>;
export type PostUpdate = z.infer<typeof postUpdateSchema>;
export type PostListQuery = z.infer<typeof postListQuerySchema>;

const splitCsv = (raw: string): Array<string> =>
  raw.split(",").flatMap((token) => {
    const trimmed = token.trim();
    return trimmed === "" ? [] : [trimmed];
  });

const formString = (value: ReturnType<FormData["get"]>): string =>
  typeof value === "string" ? value : "";

export const postCreateFromFormData = (formData: FormData): PostCreate => {
  const scheduledAtRaw = formString(formData.get("scheduledAt"));
  const categoriesRaw = formString(formData.get("categories"));
  const tagsRaw = formString(formData.get("tags"));
  const excerptRaw = formString(formData.get("excerpt"));
  const focusKeywordRaw = formString(formData.get("focusKeyword"));
  return postCreateSchema.parse({
    body: formData.get("body"),
    categories: splitCsv(categoriesRaw),
    excerpt: excerptRaw === "" ? undefined : excerptRaw,
    focusKeyword: focusKeywordRaw === "" ? undefined : focusKeywordRaw,
    niches: formData.getAll("niches").flatMap((value) => {
      return typeof value === "string" && value !== "" ? [value] : [];
    }),
    publish: formData.get("publish") === "on",
    scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw) : undefined,
    siteId: formData.get("siteId"),
    slug: formData.get("slug"),
    tags: splitCsv(tagsRaw),
    title: formData.get("title"),
  });
};
