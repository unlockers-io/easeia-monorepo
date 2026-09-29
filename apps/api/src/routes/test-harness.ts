import { honoEvlog } from "@repo/observability/hono";
import { Hono } from "hono";
import type { Env, MiddlewareHandler } from "hono";

import { errorHandler } from "@/middleware/error-handler";

// Direct router requests skip `onError`; this mirrors the production error path and logger.
export const mountForTest = <E extends Env>(router: Hono<E>): Hono => {
  const app = new Hono();
  app.use("*", honoEvlog());
  app.route("/", router);
  app.onError(errorHandler);
  return app;
};

const bypassMiddleware: MiddlewareHandler = (_context, next) => next();

const allowAction = (): MiddlewareHandler => bypassMiddleware;

export { allowAction, bypassMiddleware };
