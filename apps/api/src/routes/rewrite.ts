import { createRoute } from "@hono/zod-openapi";
import { rewriteBackfill } from "@repo/backfill";
import type { Action } from "@repo/policy";
import * as Posts from "@repo/posts";
import type { MiddlewareHandler } from "hono";

import { createRouter } from "@/lib/openapi";
import {
  commonErrors,
  errorResponse,
  jsonResponse,
  queuedJobSchema,
  orchestratorStatusSchema,
  forceBodySchema,
  idParamSchema,
} from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

type RewriteRouteDependencies = {
  apiAuth: MiddlewareHandler;
  audit: typeof recordAudit;
  rateLimit: MiddlewareHandler;
  readStatus: typeof rewriteBackfill.readStatus;
  requestRewrite: typeof Posts.requestRewrite;
  requirePermission: (action: Action) => MiddlewareHandler<{ Variables: AuthVariables }>;
  start: typeof rewriteBackfill.start;
};

const createRewriteRoutes = (dependencies: RewriteRouteDependencies) => {
  const app = createRouter<{ Variables: AuthVariables }>();

  app.use("*", dependencies.apiAuth);
  app.use("*", dependencies.rateLimit);

  app.openapi(
    createRoute({
      method: "post",
      middleware: [dependencies.requirePermission("sync:write")] as const,
      path: "/network",
      request: { body: { content: { "application/json": { schema: forceBodySchema } } } },
      responses: { ...commonErrors, 202: jsonResponse("Job queued", queuedJobSchema) },
      security: [{ bearerAuth: [] }],
      summary: "Start network rewrite",
      tags: ["Network"],
    }),
    async (c) => {
      const { jobId } = await dependencies.start({ force: c.req.valid("json").force ?? false });
      await dependencies.audit(c, { action: "rewrite.trigger", target: "network" });
      return c.json({ jobId }, 202);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      middleware: [dependencies.requirePermission("posts:write")] as const,
      path: "/post/{id}",
      request: {
        body: { content: { "application/json": { schema: forceBodySchema } } },
        params: idParamSchema,
      },
      responses: {
        ...commonErrors,
        202: jsonResponse("Job queued", queuedJobSchema),
        503: errorResponse("AI is not configured or its allowance is exhausted"),
      },
      security: [{ bearerAuth: [] }],
      summary: "Rewrite a post",
      tags: ["Network"],
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const job = await dependencies.requestRewrite(id, {
        force: c.req.valid("json").force ?? false,
      });
      await dependencies.audit(c, { action: "rewrite.trigger", target: `post:${id}` });
      return c.json({ jobId: job.id }, 202);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      middleware: [dependencies.requirePermission("jobs:read")] as const,
      path: "/status",
      responses: {
        ...commonErrors,
        200: jsonResponse("Pipeline status", orchestratorStatusSchema),
      },
      security: [{ bearerAuth: [] }],
      summary: "Read rewrite status",
      tags: ["Network"],
    }),
    async (c) => c.json(await dependencies.readStatus(), 200),
  );

  return app;
};

const rewriteRoutes = createRewriteRoutes({
  apiAuth: apiAuthMiddleware,
  audit: recordAudit,
  rateLimit: apiRateLimit,
  readStatus: rewriteBackfill.readStatus,
  requestRewrite: Posts.requestRewrite,
  requirePermission: requireAction,
  start: rewriteBackfill.start,
});

export { createRewriteRoutes, rewriteRoutes };
export type { RewriteRouteDependencies };
