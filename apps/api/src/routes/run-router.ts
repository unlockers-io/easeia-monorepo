import { createRoute } from "@hono/zod-openapi";
import type { backfills } from "@repo/backfill";

import { commonErrors, jsonResponse, orchestratorStatusSchema } from "@/lib/openapi-schemas";
import { createProtectedRouter, type Guards } from "@/lib/protected-router";

export type RunRouteDependencies = Guards & {
  readStatus: (typeof backfills)[keyof typeof backfills]["readStatus"];
};

export const createRunRouter = (deps: RunRouteDependencies) => {
  const app = createProtectedRouter(deps);
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
