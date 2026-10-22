import { createRoute } from "@hono/zod-openapi";
import type { networkBackfill } from "@repo/backfill";
import type { Action } from "@repo/policy";
import type { MiddlewareHandler } from "hono";

import { createRouter } from "@/lib/openapi";
import { commonErrors, jsonResponse, orchestratorStatusSchema } from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";

export type RunRouteDependencies = {
  apiAuth: MiddlewareHandler;
  rateLimit: MiddlewareHandler;
  readStatus: typeof networkBackfill.readStatus;
  requirePermission: (action: Action) => MiddlewareHandler<{ Variables: AuthVariables }>;
};

export const createRunRouter = (deps: RunRouteDependencies) => {
  const app = createRouter<{ Variables: AuthVariables }>();
  app.use("*", deps.apiAuth);
  app.use("*", deps.rateLimit);
  app.openapi(
    createRoute({
      method: "get",
      middleware: [deps.requirePermission("jobs:read")] as const,
      path: "/status",
      responses: { ...commonErrors, 200: jsonResponse("Run status", orchestratorStatusSchema) },
      security: [{ bearerAuth: [] }],
      summary: "Read run status",
      tags: ["Network"],
    }),
    async (c) => c.json(await deps.readStatus(), 200),
  );

  return app;
};
