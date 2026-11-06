import { LinkType } from "@repo/db/browser";
import { z } from "zod";

export const suggestionListQuerySchema = z.object({
  cursor: z.string().optional(),
  fromPostId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  siteId: z.string().optional(),
  targetSiteId: z.string().optional(),
  type: z.enum(["INTERNAL", "PBN"]).optional(),
});

export const suggestionAnchorPatchSchema = z.strictObject({
  anchorText: z.string().trim().min(2).max(120),
});

const postReferenceSchema = z.object({
  id: z.string(),
  site: z.object({ domain: z.string() }),
  siteId: z.string(),
  slug: z.string(),
  title: z.string(),
});

export const suggestionPublicSchema = z.object({
  anchorText: z.string(),
  fromPost: postReferenceSchema,
  id: z.string(),
  suggestedAt: z.coerce.date().nullable(),
  toPost: postReferenceSchema.nullable(),
  type: z.enum(LinkType),
});

export const suggestionPageSchema = z.object({
  data: z.array(suggestionPublicSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});

export type SuggestionListQuery = z.infer<typeof suggestionListQuerySchema>;
