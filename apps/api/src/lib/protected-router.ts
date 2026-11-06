import * as Policy from "@repo/policy";
import type { Context, MiddlewareHandler } from "hono";

import { apiAuthMiddleware, requireAction, type AuthVariables } from "@/middleware/api-auth";
import { apiRateLimit } from "@/middleware/security";

import { createRouter } from "./openapi";

export type Guards = {
  apiAuth: MiddlewareHandler;
  audit: (c: Context<{ Variables: AuthVariables }>, entry: Policy.AuditEntry) => Promise<void>;
  rateLimit: MiddlewareHandler;
  requirePermission: (
    action: Policy.Action,
    siteParam?: string,
  ) => MiddlewareHandler<{ Variables: AuthVariables }>;
};

export const guards: Guards = {
  apiAuth: apiAuthMiddleware,
  audit: (c, entry) => Policy.recordAudit(c.get("actor"), entry),
  rateLimit: apiRateLimit,
  requirePermission: requireAction,
};

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the build router adds its Site to the context
export const createProtectedRouter = <Variables extends AuthVariables = AuthVariables>({
  apiAuth,
  rateLimit,
}: Pick<Guards, "apiAuth" | "rateLimit">) => {
  const router = createRouter<{ Variables: Variables }>();
  router.use("*", apiAuth);
  router.use("*", rateLimit);

  return router;
};
