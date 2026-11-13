import { identifyUser } from "@repo/observability/auth";
import { authenticate, can, type Action, type Actor } from "@repo/policy";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { sessions } from "../lib/auth";

export type AuthVariables = { actor: Actor };

const sessionActor = async (c: Context): Promise<Actor | null> => {
  let session: Awaited<ReturnType<typeof sessions.getSession>>;

  try {
    session = await sessions.getSession({ headers: c.req.raw.headers });
  } catch (error) {
    c.get("log").error(error instanceof Error ? error : "session lookup failed");
    throw new HTTPException(503, { message: "Authentication service unavailable" });
  }

  if (session === null) {
    return null;
  }

  identifyUser(c.get("log"), session);

  return { id: session.user.id, kind: "user" };
};

export const apiAuthMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const actor = (await authenticate(c.req.header("Authorization"))) ?? (await sessionActor(c));

  if (!actor) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  c.set("actor", actor);

  return next();
});

export const requireAction = (action: Action, siteParam?: string) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const siteId = siteParam === undefined ? undefined : c.req.param(siteParam);
    const decision = can(c.get("actor"), action, siteId);

    if (!decision.allowed) {
      throw new HTTPException(403, { message: decision.reason });
    }

    return next();
  });
