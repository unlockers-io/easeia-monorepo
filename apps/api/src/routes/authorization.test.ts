import "@hono/zod-openapi";

import type { Post } from "@repo/db";
import type { Actor } from "@repo/policy";
import type * as Posts from "@repo/posts";
import { fakeSite } from "@repo/sites/fake";
import type { MiddlewareHandler } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAction } from "@/middleware/api-auth";
import type { AuthVariables } from "@/middleware/api-auth";

import { createApiKeyRoutes } from "./api-keys";
import { createPostRoutes } from "./posts";
import { createSiteRoutes } from "./sites";
import { bypassMiddleware, mountForTest } from "./test-harness";

let actor: Actor = { id: "admin", kind: "user" };

const apiAuth: MiddlewareHandler<{ Variables: AuthVariables }> = (c, next) => {
  c.set("actor", actor);

  return next();
};

const post: Post = {
  body: "Body",
  categories: [],
  createdAt: new Date(),
  excerpt: null,
  focusKeyword: null,
  id: "p1",
  niches: [],
  publishedAt: null,
  rewrittenAt: null,
  scheduledAt: null,
  siteId: "s1",
  slug: "post",
  status: "DRAFT",
  tags: [],
  title: "Title",
  updatedAt: new Date(),
};

const writers = {
  create: vi.fn<typeof Posts.create>().mockResolvedValue({ post }),
  get: vi.fn<typeof Posts.get>().mockResolvedValue(post),
  heroUrls: vi.fn<typeof Posts.heroUrls>().mockResolvedValue(new Map()),
  list: vi.fn<typeof Posts.list>().mockResolvedValue({ data: [], meta: { nextCursor: undefined } }),
  publish: vi.fn<typeof Posts.publish>().mockResolvedValue({ job: { id: "j1" }, post }),
  remove: vi.fn<typeof Posts.remove>().mockResolvedValue(post),
  unpublish: vi.fn<typeof Posts.unpublish>().mockResolvedValue({ post }),
  update: vi.fn<typeof Posts.update>().mockResolvedValue(post),
};

const key = {
  createdAt: new Date(),
  id: "key",
  lastUsed: null,
  name: "test",
  prefix: "test",
  revokedAt: null,
  scopes: [],
  siteId: null,
  token: "token",
};

const createKey = vi.fn().mockResolvedValue(key);
const listKeys = vi.fn().mockResolvedValue([]);
const revokeKey = vi.fn().mockResolvedValue(undefined);

const common = {
  apiAuth,
  audit: () => Promise.resolve(),
  rateLimit: bypassMiddleware,
  requirePermission: requireAction,
};

const posts = mountForTest(createPostRoutes({ ...common, posts: writers }));
const keys = mountForTest(createApiKeyRoutes({ ...common, createKey, listKeys, revokeKey }));

const sites = mountForTest(
  createSiteRoutes({
    ...common,
    createSite: vi.fn(),
    listSites: vi.fn().mockResolvedValue([]),
    loadSite: vi.fn((id: string) => Promise.resolve(fakeSite({ id }))),
    updateSite: vi.fn((id: string) => Promise.resolve(fakeSite({ id }))),
  }),
);

const postCases = [
  ["GET", "/", undefined, 200, writers.list],
  ["GET", "/p1", undefined, 200, writers.get],
  ["POST", "/", { body: "Body", siteId: "s1", slug: "post", title: "Title" }, 201, writers.create],
  ["PATCH", "/p1", { title: "New" }, 200, writers.update],
  ["DELETE", "/p1", undefined, 200, writers.remove],
  ["POST", "/p1/publish", undefined, 202, writers.publish],
  ["POST", "/p1/unpublish", undefined, 200, writers.unpublish],
] as const;

const keyCases = [
  ["GET", "/", undefined, 200, listKeys],
  ["POST", "/", { name: "test", scopes: ["posts:read"] }, 201, createKey],
  ["DELETE", "/key", undefined, 200, revokeKey],
] as const;

const request = (
  app: typeof posts,
  method: string,
  path: string,
  body: Record<string, string | ReadonlyArray<string> | null> | undefined,
) => {
  const init: RequestInit = { method };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }

  return app.request(path, init);
};

const actors = [
  {
    actor: { id: "read", kind: "apikey", scopes: ["posts:read"], siteId: null },
    admin: false,
    read: true,
    write: false,
  },
  {
    actor: { id: "write", kind: "apikey", scopes: ["posts:write"], siteId: null },
    admin: false,
    read: false,
    write: true,
  },
  {
    actor: { id: "build", kind: "apikey", scopes: ["content:read"], siteId: "s1" },
    admin: false,
    read: false,
    write: false,
  },
  { actor: { id: "user", kind: "user" }, admin: true, read: true, write: true },
] as const;

describe("mounted route authorization", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(actors)("enforces Post access for $actor.id", async (access) => {
    actor = access.actor;

    for (const [method, path, body, success, handler] of postCases) {
      vi.clearAllMocks();
      const allowed = method === "GET" ? access.read : access.write;
      const response = await request(posts, method, path, body);
      expect(response.status, `${actor.id} ${method} ${path}`).toBe(allowed ? success : 403);
      expect(handler).toHaveBeenCalledTimes(Number(allowed));
    }
  });
  it.each(actors)("enforces API-key administration for $actor.id", async (access) => {
    actor = access.actor;

    for (const [method, path, body, success, handler] of keyCases) {
      vi.clearAllMocks();
      const response = await request(keys, method, path, body);
      expect(response.status, `${actor.id} ${method} ${path}`).toBe(access.admin ? success : 403);
      expect(handler).toHaveBeenCalledTimes(Number(access.admin));
    }
  });
});

it("keeps a Site-bound key on the Site named in the path", async () => {
  actor = { id: "bound", kind: "apikey", scopes: ["sites:read", "sites:write"], siteId: "s1" };
  const patch = { vercelProjectName: "photos" };

  const responses = await Promise.all([
    request(sites, "GET", "/s1", undefined),
    request(sites, "PATCH", "/s1", patch),
    request(sites, "GET", "/s2", undefined),
    request(sites, "PATCH", "/s2", patch),
    request(sites, "PATCH", "/s2/money-site", { moneySiteId: null }),
  ]);

  expect(responses.map((response) => response.status)).toEqual([200, 200, 403, 403, 403]);
});
