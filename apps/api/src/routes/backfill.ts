import { createRoute } from "@hono/zod-openapi";
import { networkBackfill } from "@repo/backfill";

import { commonErrors, jsonResponse, startedRunSchema } from "@/lib/openapi-schemas";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

import { createRunRouter, type RunRouteDependencies } from "./run-router";

type BackfillRouteDependencies = RunRouteDependencies & {
  audit: typeof recordAudit;
  start: typeof networkBackfill.start;
};

const createBackfillRoutes = (dependencies: BackfillRouteDependencies) => {
  const app = createRunRouter(dependencies);

  app.openapi(
    createRoute({
      method: "post",
      middleware: [dependencies.requirePermission("sync:write")] as const,
      path: "/network",
      request: {},
      responses: { ...commonErrors, 202: jsonResponse("Run started", startedRunSchema) },
      security: [{ bearerAuth: [] }],
      summary: "Start network backfill",
      tags: ["Network"],
    }),
    async (c) => {
      const { runId } = await dependencies.start();
      await dependencies.audit(c, { action: "backfill.trigger", target: "network" });
      return c.json({ runId }, 202);
    },
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
