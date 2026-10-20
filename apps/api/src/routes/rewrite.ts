import { createRoute } from "@hono/zod-openapi";
import { rewriteBackfill } from "@repo/backfill";
import * as Posts from "@repo/posts";

import {
  commonErrors,
  errorResponse,
  jsonResponse,
  queuedJobSchema,
  startedRunSchema,
  forceBodySchema,
  idParamSchema,
} from "@/lib/openapi-schemas";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

import { createRunRouter, type RunRouteDependencies } from "./run-router";

type RewriteRouteDependencies = RunRouteDependencies & {
  audit: typeof recordAudit;
  requestRewrite: typeof Posts.requestRewrite;
  start: typeof rewriteBackfill.start;
};

const createRewriteRoutes = (dependencies: RewriteRouteDependencies) => {
  const app = createRunRouter(dependencies);

  app.openapi(
    createRoute({
      method: "post",
      middleware: [dependencies.requirePermission("sync:write")] as const,
      path: "/network",
      request: { body: { content: { "application/json": { schema: forceBodySchema } } } },
      responses: { ...commonErrors, 202: jsonResponse("Run started", startedRunSchema) },
      security: [{ bearerAuth: [] }],
      summary: "Start network rewrite",
      tags: ["Network"],
    }),
    async (c) => {
      const { runId } = await dependencies.start({ force: c.req.valid("json").force ?? false });
      await dependencies.audit(c, { action: "rewrite.trigger", target: "network" });
      return c.json({ runId }, 202);
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
