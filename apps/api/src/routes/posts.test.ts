import "@hono/zod-openapi";

import type { Post } from "@repo/db";
import type * as Posts from "@repo/posts";
import { describe, expect, it, vi } from "vitest";

import { createPostRoutes } from "./posts";
import { mountForTest, openGuards } from "./test-harness";

const row: Post = {
  body: "Body",
  categories: ["guides"],
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  excerpt: null,
  focusKeyword: null,
  id: "p1",
  niches: [],
  publishedAt: null,
  rewrittenAt: new Date("2026-11-02T10:00:00.000Z"),
  scheduledAt: null,
  siteId: "s1",
  slug: "post",
  status: "DRAFT",
  tags: [],
  title: "Title",
  updatedAt: new Date("2026-11-03T10:00:00.000Z"),
};

const declared = {
  body: "Body",
  categories: ["guides"],
  createdAt: "2026-11-01T10:00:00.000Z",
  excerpt: null,
  featuredImage: "https://img.example/hero.jpg",
  focusKeyword: null,
  id: "p1",
  niches: [],
  publishedAt: null,
  scheduledAt: null,
  siteId: "s1",
  slug: "post",
  status: "DRAFT",
  tags: [],
  title: "Title",
  updatedAt: "2026-11-03T10:00:00.000Z",
};

const heroes = new Map([["p1", "https://img.example/hero.jpg"]]);

const app = mountForTest(
  createPostRoutes({
    ...openGuards,
    posts: {
      create: vi.fn<typeof Posts.create>().mockResolvedValue({ job: { id: "j1" }, post: row }),
      get: vi.fn<typeof Posts.get>().mockResolvedValue(row),
      heroUrls: vi.fn<typeof Posts.heroUrls>().mockResolvedValue(heroes),
      list: vi
        .fn<typeof Posts.list>()
        .mockResolvedValue({ data: [row], meta: { nextCursor: undefined } }),
      publish: vi.fn<typeof Posts.publish>(),
      remove: vi.fn<typeof Posts.remove>(),
      unpublish: vi.fn<typeof Posts.unpublish>(),
      update: vi.fn<typeof Posts.update>().mockResolvedValue(row),
    },
  }),
);

const json = (method: string, body: Record<string, string>) => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
  method,
});

describe("Post responses", () => {
  it("lists only the fields the Post schema declares", async () => {
    const response = await app.request("/");

    expect(await response.json()).toEqual({ data: [declared], meta: {} });
  });

  it("returns only the fields the Post schema declares", async () => {
    const response = await app.request("/p1");

    expect(await response.json()).toEqual({ data: declared });
  });

  it("creates with only the fields the Post schema declares", async () => {
    const response = await app.request(
      "/",
      json("POST", { body: "Body", siteId: "s1", slug: "post", title: "Title" }),
    );

    expect(await response.json()).toEqual({ data: declared, job: { id: "j1" } });
  });

  it("updates with only the fields the Post schema declares", async () => {
    const response = await app.request("/p1", json("PATCH", { title: "Title" }));

    expect(await response.json()).toEqual({ data: declared });
  });
});
