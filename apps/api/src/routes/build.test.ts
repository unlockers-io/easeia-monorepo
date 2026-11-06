import type { BuildPost } from "@easeia/astro-content";
import { fakeSite } from "@repo/sites/fake";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createBuildRoutes, type BuildRouteDependencies } from "./build";
import { openGuards } from "./test-harness";

const findSite = vi.fn<BuildRouteDependencies["findSite"]>();
const listImages = vi.fn<BuildRouteDependencies["listImages"]>();
const listPosts = vi.fn<BuildRouteDependencies["listPosts"]>();

const buildRoutes = createBuildRoutes({ ...openGuards, findSite, listImages, listPosts });

const makePost = (overrides: Partial<BuildPost> = {}): BuildPost => ({
  body: "body-a",
  frontmatter: {
    author: null,
    categories: ["cat"],
    description: "",
    draft: false,
    heroImage: null,
    heroImageHeight: 1,
    heroImageUrl: "https://cdn/a.jpg",
    heroImageWidth: 1,
    pubDate: "2026-02-01T00:00:00.000Z",
    seo: { canonical_url: null, focus_keyword: null },
    status: "PUBLISHED",
    tags: [],
    title: "A",
    updatedDate: "2026-02-02T00:00:00.000Z",
  },
  images: [{ alt: null, filename: "a.jpg", height: 1, url: "https://cdn/a.jpg", width: 1 }],
  slug: "a",
  ...overrides,
});

const manifestBodySchema = z.object({ contentHash: z.string() });

const manifest = async () => {
  const res = await buildRoutes.request("/sites/s1/manifest");

  return { body: manifestBodySchema.parse(await res.json()), status: res.status };
};

describe("build routes", () => {
  it("hashes identical content identically", async () => {
    findSite.mockResolvedValue(fakeSite());
    listPosts.mockResolvedValue([makePost()]);
    const first = await manifest();
    const second = await manifest();

    expect(first.body.contentHash).toBe(second.body.contentHash);
  });

  it("changes the hash when an image filename changes", async () => {
    findSite.mockResolvedValue(fakeSite());
    listPosts.mockResolvedValue([makePost()]);
    const before = await manifest();

    listPosts.mockResolvedValue([
      makePost({
        images: [
          { alt: null, filename: "renamed.jpg", height: 1, url: "https://cdn/a.jpg", width: 1 },
        ],
      }),
    ]);
    const after = await manifest();

    expect(after.body.contentHash).not.toBe(before.body.contentHash);
  });

  it.each(["authorName", "authorBio", "authorPhotoUrl", "authorUrl"] as const)(
    "changes the hash when %s changes",
    async (field) => {
      listPosts.mockResolvedValue([makePost()]);
      findSite.mockResolvedValue(fakeSite({ authorName: "Author" }));
      const before = await manifest();

      findSite.mockResolvedValue(fakeSite({ authorName: "Author", [field]: "Changed" }));
      const after = await manifest();

      expect(after.body.contentHash).not.toBe(before.body.contentHash);
    },
  );

  it("builds the posts with the site's author, or none without an author name", async () => {
    listPosts.mockResolvedValue([makePost()]);
    findSite.mockResolvedValue(
      fakeSite({ authorBio: "bio", authorName: "Marina Duarte", authorUrl: "https://m.example" }),
    );

    await buildRoutes.request("/sites/s1/posts");
    expect(listPosts).toHaveBeenLastCalledWith("s1", {
      bio: "bio",
      name: "Marina Duarte",
      photoUrl: null,
      url: "https://m.example",
    });

    findSite.mockResolvedValue(fakeSite({ authorBio: "orphan bio" }));
    await buildRoutes.request("/sites/s1/posts");
    expect(listPosts).toHaveBeenLastCalledWith("s1", null);
  });

  it.each(["manifest", "posts", "images"])("returns NOT_FOUND on /%s", async (route) => {
    findSite.mockResolvedValue(null);

    const res = await buildRoutes.request(`/sites/nope/${route}`);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Site not found" },
    });
  });

  it("looks the site up once per request", async () => {
    findSite.mockClear();
    findSite.mockResolvedValue(fakeSite());
    listPosts.mockResolvedValue([makePost()]);

    await manifest();

    expect(findSite).toHaveBeenCalledTimes(1);
  });
});
