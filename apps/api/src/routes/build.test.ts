import { PostStatus } from "@repo/db";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.hoisted(() => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    FROM_EMAIL: "test@easeia.dev",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import {
  createBuildRoutes,
  type BuildPost,
  type BuildRouteDependencies,
  type BuildSite,
} from "./build";
import { allowAction, bypassMiddleware } from "./test-harness";

const findImages = vi.fn<BuildRouteDependencies["findImages"]>();
const findPosts = vi.fn<BuildRouteDependencies["findPosts"]>();
const findSite = vi.fn<BuildRouteDependencies["findSite"]>();
const buildRoutes = createBuildRoutes({
  apiAuth: bypassMiddleware,
  findImages,
  findPosts,
  findSite,
  rateLimit: bypassMiddleware,
  requirePermission: allowAction,
  requireSiteScope: bypassMiddleware,
});

const makeSite = (overrides: Partial<BuildSite> = {}): BuildSite => ({
  authorBio: null,
  authorName: null,
  authorPhotoUrl: null,
  authorUrl: null,
  domain: "d.com",
  language: "PT_BR",
  ...overrides,
});

const makePost = (overrides: Partial<BuildPost> = {}): BuildPost => ({
  body: "body-a",
  categories: ["cat"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  excerpt: null,
  focusKeyword: null,
  id: "post-a",
  images: [
    {
      alt: null,
      blobUrl: "https://cdn/a.jpg",
      filename: "a.jpg",
      height: 1,
      id: "image-a",
      isHero: true,
      width: 1,
    },
  ],
  publishedAt: new Date("2026-02-01T00:00:00.000Z"),
  slug: "a",
  status: PostStatus.PUBLISHED,
  tags: [],
  title: "A",
  updatedAt: new Date("2026-02-02T00:00:00.000Z"),
  ...overrides,
});

const manifestBodySchema = z.object({ contentHash: z.string() });

const frontmatterAuthorSchema = z.object({ author: z.unknown() });
const postWithAuthorSchema = z.object({ frontmatter: frontmatterAuthorSchema });
const authorPayloadSchema = z.object({ data: z.array(postWithAuthorSchema) });

const manifest = async () => {
  const res = await buildRoutes.request("/sites/s1/manifest");
  return { body: manifestBodySchema.parse(await res.json()), status: res.status };
};

describe("build routes", () => {
  it("orders posts and their images totally", async () => {
    findSite.mockResolvedValue(makeSite());
    findPosts.mockResolvedValue([makePost()]);

    await manifest();

    expect(findPosts).toHaveBeenCalledWith({
      imageOrderBy: { id: "asc" },
      postOrderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      siteId: "s1",
      status: PostStatus.PUBLISHED,
    });
  });

  it("hashes identical content identically", async () => {
    findSite.mockResolvedValue(makeSite());
    findPosts.mockResolvedValue([makePost()]);
    const first = await manifest();
    findPosts.mockResolvedValue([makePost()]);
    const second = await manifest();

    expect(first.body.contentHash).toBe(second.body.contentHash);
  });

  it("changes the hash when an image filename changes", async () => {
    findSite.mockResolvedValue(makeSite());
    findPosts.mockResolvedValue([makePost()]);
    const before = await manifest();

    findPosts.mockResolvedValue([
      makePost({
        images: [
          {
            alt: null,
            blobUrl: "https://cdn/a.jpg",
            filename: "renamed.jpg",
            height: 1,
            id: "image-a",
            isHero: true,
            width: 1,
          },
        ],
      }),
    ]);
    const after = await manifest();

    expect(after.body.contentHash).not.toBe(before.body.contentHash);
  });

  it("changes the hash when the site author changes", async () => {
    findSite.mockResolvedValue(makeSite());
    findPosts.mockResolvedValue([makePost()]);
    const before = await manifest();

    findSite.mockResolvedValue(makeSite({ authorName: "Marina Duarte" }));
    findPosts.mockResolvedValue([makePost()]);
    const after = await manifest();

    expect(after.body.contentHash).not.toBe(before.body.contentHash);
  });

  it("attaches the site author to every post's frontmatter", async () => {
    findSite.mockResolvedValue(
      makeSite({ authorBio: "bio", authorName: "Marina Duarte", authorUrl: "https://m.example" }),
    );
    findPosts.mockResolvedValue([makePost()]);

    const res = await buildRoutes.request("/sites/s1/posts");
    const body = authorPayloadSchema.parse(await res.json());

    expect(body.data[0]?.frontmatter.author).toEqual({
      bio: "bio",
      name: "Marina Duarte",
      photoUrl: null,
      url: "https://m.example",
    });
  });

  it("emits author null when the site has no author name", async () => {
    findSite.mockResolvedValue(makeSite({ authorBio: "orphan bio" }));
    findPosts.mockResolvedValue([makePost()]);

    const res = await buildRoutes.request("/sites/s1/posts");
    const body = authorPayloadSchema.parse(await res.json());

    expect(body.data[0]?.frontmatter.author).toBeNull();
  });

  it.each(["manifest", "posts", "images"])("returns NOT_FOUND on /%s", async (route) => {
    findSite.mockResolvedValue(null);

    const res = await buildRoutes.request(`/sites/nope/${route}`);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Site not found" },
    });
  });

  it("gives the images route a total order", async () => {
    findSite.mockResolvedValue(makeSite());
    findImages.mockResolvedValue([]);

    await buildRoutes.request("/sites/s1/images");

    expect(findImages).toHaveBeenCalledWith({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      siteId: "s1",
    });
  });

  it("looks the site up once per request", async () => {
    findSite.mockClear();
    findSite.mockResolvedValue(makeSite());
    findPosts.mockResolvedValue([makePost()]);

    await manifest();

    expect(findSite).toHaveBeenCalledTimes(1);
  });
});
