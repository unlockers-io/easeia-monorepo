import { createRoute } from "@hono/zod-openapi";
import { suggestionAnchorPatchSchema, suggestionListQuerySchema } from "@repo/api-types";
import {
  approveSuggestion,
  editSuggestionAnchor,
  listSuggestions,
  rejectSuggestion,
} from "@repo/links";
import type { z } from "zod";

import type { suggestionPublicSchema } from "@/lib/openapi-schemas";
import {
  commonErrors,
  idParamSchema,
  jsonResponse,
  suggestionPageSchema,
  suggestionDecisionSchema,
} from "@/lib/openapi-schemas";
import { createProtectedRouter, guards, type Guards } from "@/lib/protected-router";

type SuggestionListInput = z.infer<typeof suggestionListQuerySchema>;

type SuggestionListItem = z.infer<typeof suggestionPublicSchema>;

type SuggestionResult = z.infer<typeof suggestionDecisionSchema>["link"];

type SuggestionRouteDependencies = Guards & {
  approveSuggestion: (id: string) => Promise<SuggestionResult>;
  editSuggestionAnchor: (id: string, anchorText: string) => Promise<SuggestionResult>;
  listSuggestions: (
    input: SuggestionListInput,
  ) => Promise<{ data: Array<SuggestionListItem>; nextCursor: string | undefined }>;
  rejectSuggestion: (id: string) => Promise<SuggestionResult>;
};

const createSuggestionRoutes = (dependencies: SuggestionRouteDependencies) => {
  const app = createProtectedRouter(dependencies);

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
      const { data, nextCursor } = await dependencies.listSuggestions(c.req.valid("query"));

      return c.json({ data, meta: { nextCursor: nextCursor ?? null } }, 200);
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
  ...guards,
  approveSuggestion,
  editSuggestionAnchor,
  listSuggestions,
  rejectSuggestion,
});

export { createSuggestionRoutes, suggestionRoutes };

export type { SuggestionRouteDependencies };
