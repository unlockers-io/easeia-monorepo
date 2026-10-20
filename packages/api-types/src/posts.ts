import { Niche, PostStatus } from "@repo/db/browser";
import { z } from "zod";

const nicheSchema = z.enum(Niche);
const nicheFilterSchema = z.union([nicheSchema, z.array(nicheSchema)]);

const postFields = {
  body: z.string().min(1),
  categories: z.array(z.string()),
  excerpt: z.string().max(300).nullable().optional(),
  focusKeyword: z.string().max(80).nullable().optional(),
  niches: z.array(nicheSchema),
  scheduledAt: z.coerce.date().optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/v, "kebab-case lowercase only"),
  tags: z.array(z.string()),
  title: z.string().min(1).max(160),
};

export const postCreateSchema = z.object({
  ...postFields,
  categories: postFields.categories.default([]),
  niches: postFields.niches.default([]),
  publish: z.boolean().default(false),
  siteId: z.string().min(1),
  tags: postFields.tags.default([]),
});

export const postUpdateSchema = z.object(postFields).partial();

export const postListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  niche: nicheFilterSchema.optional(),
  q: z.string().optional(),
  siteId: z.string().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  status: z.enum(PostStatus).optional(),
});

export type PostCreate = z.infer<typeof postCreateSchema>;
export type PostCreateInput = z.input<typeof postCreateSchema>;
export type PostUpdate = z.infer<typeof postUpdateSchema>;
export type PostUpdateInput = z.input<typeof postUpdateSchema>;
export type PostListQuery = z.infer<typeof postListQuerySchema>;
export type PostListQueryInput = z.input<typeof postListQuerySchema>;

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
