import { createRoute } from "@hono/zod-openapi";
import { JobKind } from "@repo/db";
import { readBackfillRewriteStatus, enqueue } from "@repo/jobs";
import type { Action } from "@repo/policy";
import type { MiddlewareHandler } from "hono";

import { env } from "@/lib/env";
import { createRouter } from "@/lib/openapi";
import {
  commonErrors,
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
  enqueueJob: typeof enqueue;
  getRedisUrl: () => string;
  rateLimit: MiddlewareHandler;
  readStatus: typeof readBackfillRewriteStatus;
  requirePermission: (action: Action) => MiddlewareHandler;
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
      const body = c.req.valid("json");
      const job = await dependencies.enqueueJob({
        kind: JobKind.BACKFILL_REWRITE,
        payload: {
          force: body.force ?? false,
          phase: "CRAWL_MONEY_SITE",
          startedAt: new Date().toISOString(),
        },
        redisUrl: dependencies.getRedisUrl(),
      });
      await dependencies.audit(c, { action: "rewrite.trigger", target: "network" });
      return c.json({ jobId: job.id }, 202);
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
      responses: { ...commonErrors, 202: jsonResponse("Job queued", queuedJobSchema) },
      security: [{ bearerAuth: [] }],
      summary: "Rewrite a post",
      tags: ["Network"],
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const body = c.req.valid("json");
      const job = await dependencies.enqueueJob({
        kind: JobKind.REWRITE_POST,
        payload: { force: body.force ?? false, postId: id },
        postId: id,
        redisUrl: dependencies.getRedisUrl(),
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
  enqueueJob: enqueue,
  getRedisUrl: () => env.REDIS_URL,
  rateLimit: apiRateLimit,
  readStatus: readBackfillRewriteStatus,
  requirePermission: requireAction,
});

export { createRewriteRoutes, rewriteRoutes };
export type { RewriteRouteDependencies };
