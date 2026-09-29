import { z } from "@hono/zod-openapi";

const errorDetailSchema = z.object({ field: z.string(), message: z.string() });

const errorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: "NOT_FOUND" }),
      details: z.array(errorDetailSchema).optional(),
      message: z.string().openapi({ example: "Resource not found" }),
    }),
  })
  .openapi("ErrorEnvelope");

export const errorResponse = (description: string) => ({
  content: { "application/json": { schema: errorSchema } },
  description,
});

export const idParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ example: "ckxxx0001abc", param: { in: "path", name: "id" } }),
});

export const queuedJobSchema = z.object({ jobId: z.string() });
export const okSchema = z.object({ ok: z.boolean() });
export const forceBodySchema = z.object({ force: z.boolean().optional() });
export const orchestratorStatusSchema = z.object({
  active: z.boolean(),
  counts: z.record(z.string(), z.number()).optional(),
  ended: z.enum(["done", "failed"]).nullable().optional(),
  phase: z.string().optional(),
  startedAt: z.string().optional(),
});
const moneySiteSchema = z.object({
  contentPathPrefix: z.string().nullable(),
  createdAt: z.coerce.date(),
  domain: z.string(),
  id: z.string(),
  isEnabled: z.boolean(),
  name: z.string(),
  sitemapUrl: z.string(),
  updatedAt: z.coerce.date(),
});
export const moneySiteResponseSchema = z.object({ data: moneySiteSchema });
const pageCountSchema = z.object({ pages: z.number() });
const countedMoneySiteSchema = moneySiteSchema.extend({ _count: pageCountSchema });
export const moneySiteListSchema = z.object({ data: z.array(countedMoneySiteSchema) });
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
  type: z.enum(["INTERNAL", "PBN", "EXTERNAL"]),
});
export const suggestionPageSchema = z.object({
  data: z.array(suggestionPublicSchema),
  meta: z.object({ nextCursor: z.string().nullable() }),
});
export const suggestionDecisionSchema = z.object({
  link: z.object({ anchorText: z.string(), approved: z.boolean().nullable(), id: z.string() }),
});
export const jsonResponse = <T extends z.ZodType>(description: string, schema: T) => ({
  content: { "application/json": { schema } },
  description,
});
export const commonErrors = {
  400: errorResponse("Invalid request"),
  401: errorResponse("Authentication required"),
  403: errorResponse("Insufficient scope"),
  404: errorResponse("Resource not found"),
  409: errorResponse("Resource conflict"),
  429: errorResponse("Rate limit exceeded"),
};
