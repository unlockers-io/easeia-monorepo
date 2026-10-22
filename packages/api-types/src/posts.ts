import { Niche, PostStatus } from "@repo/db/browser";
import { z } from "zod";

const nicheSchema = z.enum(Niche);
const nicheFilterSchema = z.union([nicheSchema, z.array(nicheSchema)]);

export const POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/v;

const postFields = {
  body: z.string().min(1),
  categories: z.array(z.string()),
  excerpt: z.string().max(300).nullable().optional(),
  focusKeyword: z.string().max(80).nullable().optional(),
  niches: z.array(nicheSchema),
  scheduledAt: z.coerce.date().optional(),
  slug: z.string().min(1).regex(POST_SLUG_PATTERN, "kebab-case lowercase only"),
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
