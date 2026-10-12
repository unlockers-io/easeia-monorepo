import { createRoute } from "@hono/zod-openapi";
import { suggestionAnchorPatchSchema, suggestionListQuerySchema } from "@repo/api-types";
import {
  approveSuggestion,
  editSuggestionAnchor,
  listSuggestions,
  rejectSuggestion,
} from "@repo/links";
import type { Action } from "@repo/policy";
import type { MiddlewareHandler } from "hono";
import type { z } from "zod";

import { createRouter } from "@/lib/openapi";
import type { suggestionPublicSchema } from "@/lib/openapi-schemas";
import {
  commonErrors,
  idParamSchema,
  jsonResponse,
  suggestionPageSchema,
  suggestionDecisionSchema,
} from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

type SuggestionListInput = z.infer<typeof suggestionListQuerySchema>;
type SuggestionListItem = z.infer<typeof suggestionPublicSchema>;
type SuggestionResult = z.infer<typeof suggestionDecisionSchema>["link"];
type SuggestionRouteDependencies = {
  apiAuth: MiddlewareHandler;
  approveSuggestion: (id: string) => Promise<SuggestionResult>;
  audit: typeof recordAudit;
  editSuggestionAnchor: (id: string, anchorText: string) => Promise<SuggestionResult>;
  listSuggestions: (input: SuggestionListInput) => Promise<ReadonlyArray<SuggestionListItem>>;
  rateLimit: MiddlewareHandler;
  rejectSuggestion: (id: string) => Promise<SuggestionResult>;
  requirePermission: (action: Action) => MiddlewareHandler<{ Variables: AuthVariables }>;
};

const createSuggestionRoutes = (dependencies: SuggestionRouteDependencies) => {
  const app = createRouter<{ Variables: AuthVariables }>();

  app.use("*", dependencies.apiAuth);
  app.use("*", dependencies.rateLimit);

  app.openapi(
    createRoute({
      method: "get",
      middleware: [dependencies.requirePermission("posts:read")] as const,
      path: "/",
      request: { query: suggestionListQuerySchema },
      responses: {
        ...commonErrors,
        200: jsonResponse("List pending suggestions", suggestionPageSchema),
      },
      security: [{ bearerAuth: [] }],
      summary: "List pending suggestions",
      tags: ["Network"],
    }),
    async (c) => {
      const parsed = c.req.valid("query");
      const rows = await dependencies.listSuggestions(parsed);
      return c.json(
        {
          data: rows.slice(0, parsed.limit),
          meta: {
            nextCursor: rows.length > parsed.limit ? (rows[parsed.limit]?.id ?? null) : null,
          },
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      middleware: [dependencies.requirePermission("posts:write")] as const,
      path: "/{id}/approve",
      request: { params: idParamSchema },
      responses: {
        ...commonErrors,
        200: jsonResponse("Approve suggestion", suggestionDecisionSchema),
      },
      security: [{ bearerAuth: [] }],
      summary: "Approve suggestion",
      tags: ["Network"],
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const link = await dependencies.approveSuggestion(id);
      await dependencies.audit(c, { action: "link.approve", target: `link:${id}` });
      return c.json({ link }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      middleware: [dependencies.requirePermission("posts:write")] as const,
      path: "/{id}/reject",
      request: { params: idParamSchema },
      responses: {
        ...commonErrors,
        200: jsonResponse("Reject suggestion", suggestionDecisionSchema),
      },
      security: [{ bearerAuth: [] }],
      summary: "Reject suggestion",
      tags: ["Network"],
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const link = await dependencies.rejectSuggestion(id);
      await dependencies.audit(c, { action: "link.reject", target: `link:${id}` });
      return c.json({ link }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      middleware: [dependencies.requirePermission("posts:write")] as const,
      path: "/{id}/anchor",
      request: {
        body: {
          content: { "application/json": { schema: suggestionAnchorPatchSchema } },
          required: true,
        },
        params: idParamSchema,
      },
      responses: {
        ...commonErrors,
        200: jsonResponse("Edit suggestion anchor", suggestionDecisionSchema),
      },
      security: [{ bearerAuth: [] }],
      summary: "Edit suggestion anchor",
      tags: ["Network"],
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const parsed = c.req.valid("json");
      const link = await dependencies.editSuggestionAnchor(id, parsed.anchorText);
      await dependencies.audit(c, { action: "link.update", target: `link:${id}` });
      return c.json({ link }, 200);
    },
  );

  return app;
};

const suggestionRoutes = createSuggestionRoutes({
  apiAuth: apiAuthMiddleware,
  approveSuggestion,
  audit: recordAudit,
  editSuggestionAnchor,
  listSuggestions,
  rateLimit: apiRateLimit,
  rejectSuggestion,
  requirePermission: requireAction,
});

export { createSuggestionRoutes, suggestionRoutes };
export type { SuggestionRouteDependencies };
