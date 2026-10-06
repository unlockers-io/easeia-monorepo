import { authenticate, can, type Action, type Actor } from "@repo/policy";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { auth } from "../lib/auth";

export type AuthVariables = { actor: Actor };

const sessionActor = async (c: Context): Promise<Actor | null> => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return session ? { id: session.user.id, kind: "user" } : null;
  } catch (error) {
    c.get("log").error(error instanceof Error ? error : "session lookup failed");
    throw new HTTPException(503, { message: "Authentication service unavailable" });
  }
};

export const apiAuthMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const actor = (await authenticate(c.req.header("Authorization"))) ?? (await sessionActor(c));
  if (!actor) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  c.set("actor", actor);
  return next();
});

export const requireAction = (action: Action) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const decision = can(c.get("actor"), action, c.req.param("siteId"));
    if (!decision.allowed) {
      throw new HTTPException(403, { message: decision.reason });
    }
    return next();
  });
