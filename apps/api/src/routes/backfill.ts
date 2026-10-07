import { createRoute } from "@hono/zod-openapi";
import { networkBackfill } from "@repo/backfill";
import type { Action } from "@repo/policy";
import type { MiddlewareHandler } from "hono";

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
  rateLimit: MiddlewareHandler;
  readStatus: typeof networkBackfill.readStatus;
  requirePermission: (action: Action) => MiddlewareHandler<{ Variables: AuthVariables }>;
  start: typeof networkBackfill.start;
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
      const { jobId } = await dependencies.start();
      await dependencies.audit(c, { action: "backfill.trigger", target: "network" });
      return c.json({ jobId }, 202);
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
  rateLimit: apiRateLimit,
  readStatus: networkBackfill.readStatus,
  requirePermission: requireAction,
  start: networkBackfill.start,
});

export { backfillRoutes, createBackfillRoutes };
export type { BackfillRouteDependencies };
