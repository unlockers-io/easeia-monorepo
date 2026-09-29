import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { getActor, type AuthVariables } from "./actor";

// Async despite doing no IO: a synchronous throw would escape the call rather
// than rejecting the returned promise, changing how failures surface.
export const requireMatchingSiteKey = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const actor = getActor(c);
    if (actor === undefined) {
      throw new HTTPException(401, { message: "Authentication required" });
    }
    if (actor.kind === "user") {
      return next();
    }
    const siteId = c.req.param("siteId");
    if (siteId === undefined || siteId === "") {
      throw new HTTPException(400, { message: "siteId path param required" });
    }
    // The binding comes from the row authentication already read, so both
    // decisions are made against one snapshot of the key.
    if (actor.siteId !== siteId) {
      throw new HTTPException(403, { message: "API key is not scoped to this site" });
    }
    return next();
  },
);
