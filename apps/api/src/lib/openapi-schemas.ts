import { z } from "@hono/zod-openapi";
import { moneySiteListItemSchema, moneySitePublicSchema } from "@repo/api-types";

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

export const startedRunSchema = z.object({ runId: z.string() });
export const queuedJobSchema = z.object({ jobId: z.string() });
export const okSchema = z.object({ ok: z.literal(true) }).openapi("OkResponse");
export const forceBodySchema = z.object({ force: z.boolean().optional() });

export { backfillRunStatusSchema as orchestratorStatusSchema } from "@repo/api-types";

export const moneySiteResponseSchema = z.object({ data: moneySitePublicSchema });
export const moneySiteListSchema = z.object({ data: z.array(moneySiteListItemSchema) });

export { suggestionPageSchema, suggestionPublicSchema } from "@repo/api-types";

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
