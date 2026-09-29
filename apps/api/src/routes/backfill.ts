import { createRoute } from "@hono/zod-openapi";
import { JobKind } from "@repo/db";
import { readBackfillNetworkStatus, enqueue } from "@repo/jobs";
import type { Action } from "@repo/policy";
import type { MiddlewareHandler } from "hono";

import { env } from "@/lib/env";
import { createRouter } from "@/lib/openapi";
import {
  commonErrors,
  jsonResponse,
  queuedJobSchema,
  orchestratorStatusSchema,
} from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

type BackfillRouteDependencies = {
  apiAuth: MiddlewareHandler;
  audit: typeof recordAudit;
  enqueueJob: typeof enqueue;
  getRedisUrl: () => string;
  rateLimit: MiddlewareHandler;
  readStatus: typeof readBackfillNetworkStatus;
  requirePermission: (action: Action) => MiddlewareHandler;
};

const createBackfillRoutes = (dependencies: BackfillRouteDependencies) => {
  const app = createRouter<{ Variables: AuthVariables }>();

  app.use("*", dependencies.apiAuth);
  app.use("*", dependencies.rateLimit);

  app.openapi(
    createRoute({
      method: "post",
      middleware: [dependencies.requirePermission("sync:write")] as const,
      path: "/network",
      request: {},
      responses: { ...commonErrors, 202: jsonResponse("Job queued", queuedJobSchema) },
      security: [{ bearerAuth: [] }],
      summary: "Start network backfill",
      tags: ["Network"],
    }),
    async (c) => {
      const job = await dependencies.enqueueJob({
        kind: JobKind.BACKFILL_NETWORK,
        payload: { phase: "CLASSIFY_EMBED", startedAt: new Date().toISOString() },
        redisUrl: dependencies.getRedisUrl(),
      });
      await dependencies.audit(c, { action: "backfill.trigger", target: "network" });
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
      summary: "Read backfill status",
      tags: ["Network"],
    }),
    async (c) => c.json(await dependencies.readStatus(), 200),
  );

  return app;
};

const backfillRoutes = createBackfillRoutes({
  apiAuth: apiAuthMiddleware,
  audit: recordAudit,
  enqueueJob: enqueue,
  getRedisUrl: () => env.REDIS_URL,
  rateLimit: apiRateLimit,
  readStatus: readBackfillNetworkStatus,
  requirePermission: requireAction,
});

export { backfillRoutes, createBackfillRoutes };
export type { BackfillRouteDependencies };
