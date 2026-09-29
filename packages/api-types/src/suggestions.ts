import { z } from "zod";

export const suggestionListQuerySchema = z.object({
  cursor: z.string().optional(),
  fromPostId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  siteId: z.string().optional(),
  targetSiteId: z.string().optional(),
  type: z.enum(["INTERNAL", "PBN"]).optional(),
});

export const suggestionApproveSchema = z.object({
  anchorText: z.string().min(2).max(120).optional(),
});

export const suggestionAnchorPatchSchema = z.strictObject({
  anchorText: z.string().trim().min(2).max(120),
});

export type SuggestionListQuery = z.infer<typeof suggestionListQuerySchema>;
export type SuggestionAnchorPatch = z.infer<typeof suggestionAnchorPatchSchema>;
