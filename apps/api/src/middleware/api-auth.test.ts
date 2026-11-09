import type { Actor } from "@repo/policy";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { mountForTest } from "../routes/test-harness";

import { requireAction, type AuthVariables } from "./api-auth";

const buildKey: Actor = { id: "k1", kind: "apikey", scopes: ["content:read"], siteId: "site_a" };

const appFor = (actor: Actor) => {
  const router = new Hono<{ Variables: AuthVariables }>();
  router.use("*", (c, next) => {
    c.set("actor", actor);

    return next();
  });
  router.use("/sites/:siteId/*", requireAction("content:read", "siteId"));
  router.get("/sites/:siteId/posts", (c) => c.json({ ok: true }));

  return mountForTest(router);
};

describe("requireAction", () => {
  it("authorizes against the Site named in the path", async () => {
    const app = appFor(buildKey);
    const ownSite = await app.request("/sites/site_a/posts");
    const otherSite = await app.request("/sites/site_b/posts");

    expect(ownSite.status).toBe(200);
    expect(otherSite.status).toBe(403);
  });

  it("answers 403 with the policy's reason", async () => {
    const response = await appFor({ ...buildKey, scopes: [] }).request("/sites/site_a/posts");

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { message: "Missing scope: content:read" },
    });
  });
});
