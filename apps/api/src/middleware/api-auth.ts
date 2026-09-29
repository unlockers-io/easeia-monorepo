import { hashApiKeyToken, isApiKeyScope } from "@repo/api-types";
import { prisma } from "@repo/db";
import { type Action, can } from "@repo/policy";
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { auth } from "../lib/auth";

import { getActor, type AuthActor, type AuthVariables } from "./actor";

export type { AuthVariables } from "./actor";

const tryBearer = async (c: Context): Promise<AuthActor | null> => {
  const header = c.req.header("Authorization");
  if (header === undefined || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token.startsWith("easeia_")) {
    return null;
  }
  const hash = hashApiKeyToken(token);
  const key = await prisma.apiKey.findUnique({ where: { hash } });
  if (!key || key.revokedAt) {
    throw new HTTPException(401, { message: "Invalid API key" });
  }
  void (async () => {
    try {
      await prisma.apiKey.update({
        data: { lastUsed: new Date() },
        where: { id: key.id },
      });
    } catch (error) {
      c.get("log").warn("failed to update apiKey.lastUsed", {
        error: error instanceof Error ? error.message : String(error),
        keyId: key.id,
      });
    }
  })();
  return {
    id: key.id,
    kind: "apikey",
    scopes: key.scopes.filter(isApiKeyScope),
    siteId: key.siteId,
  };
};

const trySession = async (c: Context): Promise<AuthActor | null> => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session?.user) {
      return { id: session.user.id, kind: "user" };
    }
  } catch (error) {
    c.get("log").error(error instanceof Error ? error : "session lookup failed");
    throw new HTTPException(503, { message: "Authentication service unavailable" });
  }
  return null;
};

/**
 * Resolves the Actor (User session OR ApiKey bearer). Authorization
 * itself is delegated to `@repo/policy`; this middleware only knows
 * how to identify the caller.
 */
export const apiAuthMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c: Context, next: Next) => {
    const actor = (await tryBearer(c)) ?? (await trySession(c));
    if (!actor) {
      throw new HTTPException(401, { message: "Authentication required" });
    }
    c.set("actor", actor);
    return next();
  },
);

/**
 * Route guard backed by the policy module. The route doesn't know what
 * "scope" means or how admin sessions are treated; those rules live
 * in `@repo/policy`.
 */
export const requireAction = (action: Action) =>
  createMiddleware<{ Variables: AuthVariables }>((c, next) => {
    const actor = getActor(c);
    if (actor === undefined) {
      throw new HTTPException(401, { message: "Authentication required" });
    }
    const decision = can(actor, action);
    if (!decision.allowed) {
      throw new HTTPException(403, { message: decision.reason });
    }
    return next();
  });
