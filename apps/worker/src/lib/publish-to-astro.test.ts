import { createFakeBlobStore } from "@repo/blob/fake";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { makePublishToAstro, type PublishToAstroDeps } from "./publish-to-astro";

const samplePost = {
  categories: ["audio"],
  featuredImage: "https://cdn.example/hero.jpg",
  id: "p1",
  siteId: "s1",
  slug: "hello",
  tags: ["tag1"],
  title: "Hello",
};

const herolessPost = {
  categories: [],
  featuredImage: null,
  id: "p1",
  siteId: "s1",
  slug: "slug",
  tags: [],
  title: "T",
};

const makeDeps = (overrides: Partial<PublishToAstroDeps> = {}): PublishToAstroDeps => ({
  blob: createFakeBlobStore(),
  enqueueDeploy: vi.fn(() => Promise.resolve({ skipped: false })),
  fetchImage: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
  findHeroImage: vi.fn(() => Promise.resolve(null)),
  generateHero: vi.fn(),
  r2PublicBaseUrl: undefined,
  upsertPostImage: vi.fn(() => Promise.resolve(undefined)),
  ...overrides,
});

const liveSite = { imageStyle: "Professional audio studio scene." };

describe("publishToAstro", () => {
  it("uploads the hero image to blob, upserts PostImage, enqueues TRIGGER_DEPLOY", async () => {
    const deps = makeDeps();

    await makePublishToAstro(deps)({
      post: samplePost,
      redisUrl: "redis://test",
      site: liveSite,
    });

    expect(deps.upsertPostImage).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/^hero/v),
        isHero: true,
        postId: "p1",
      }),
    );
    expect(deps.enqueueDeploy).toHaveBeenCalledWith({ redisUrl: "redis://test", siteId: "s1" });
  });

  it("generates a hero when none exists and autogen is enabled, then deploys", async () => {
    const deps = makeDeps();
    await makePublishToAstro(deps)({
      autogenEnabled: true,
      post: { ...herolessPost, tags: ["t"] },
      redisUrl: "redis://x",
      site: liveSite,
    });
    expect(deps.generateHero).toHaveBeenCalledExactlyOnceWith({
      post: expect.objectContaining({ id: "p1" }),
      site: { imageStyle: liveSite.imageStyle },
    });
    expect(deps.enqueueDeploy).toHaveBeenCalledOnce();
  });

  it("still deploys (heroless) when generation throws", async () => {
    const deps = makeDeps({
      generateHero: vi.fn().mockRejectedValue(new Error("openai down")),
    });
    await makePublishToAstro(deps)({
      autogenEnabled: true,
      post: herolessPost,
      redisUrl: "redis://x",
      site: liveSite,
    });
    expect(deps.generateHero).toHaveBeenCalledOnce();
    expect(deps.enqueueDeploy).toHaveBeenCalledOnce();
  });

  it("does not generate when a hero already exists", async () => {
    const deps = makeDeps({
      findHeroImage: vi.fn(() =>
        Promise.resolve({
          blobUrl: "https://img.easeia.com/sites/s1/posts/p1/hero.jpg",
          filename: "hero.jpg",
        }),
      ),
      r2PublicBaseUrl: "https://img.easeia.com",
    });
    await makePublishToAstro(deps)({
      autogenEnabled: true,
      post: herolessPost,
      redisUrl: "redis://x",
      site: liveSite,
    });
    expect(deps.generateHero).not.toHaveBeenCalled();
  });

  it("uploads external featuredImage even when r2PublicBaseUrl is set but URL does not match", async () => {
    const deps = makeDeps({
      fetchImage: vi.fn(() => Promise.resolve(new Uint8Array([4, 5, 6]))),
      r2PublicBaseUrl: "https://img.easeia.com",
    });

    await makePublishToAstro(deps)({
      post: samplePost,
      redisUrl: "redis://test",
      site: liveSite,
    });

    expect(deps.fetchImage).toHaveBeenCalledOnce();
    expect(deps.fetchImage).toHaveBeenCalledWith("https://cdn.example/hero.jpg");
    expect(deps.upsertPostImage).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/hero/v),
        isHero: true,
        postId: "p1",
      }),
    );
    expect(deps.generateHero).not.toHaveBeenCalled();
    expect(deps.enqueueDeploy).toHaveBeenCalledWith({ redisUrl: "redis://test", siteId: "s1" });
  });

  it("generates when featuredImage is an R2 URL but no hero row backs it", async () => {
    // Regression: this combination previously matched neither branch, so the
    // post published with no hero image, no log, and no error.
    const blob = { upload: vi.fn() };
    const deps = makeDeps({ blob, r2PublicBaseUrl: "https://img.easeia.com" });

    await makePublishToAstro(deps)({
      autogenEnabled: true,
      post: {
        ...herolessPost,
        featuredImage: "https://img.easeia.com/sites/s1/posts/p1/abc.jpg",
      },
      redisUrl: "redis://x",
      site: liveSite,
    });

    expect(deps.fetchImage).not.toHaveBeenCalled();
    expect(blob.upload).not.toHaveBeenCalled();
    expect(deps.generateHero).toHaveBeenCalledOnce();
    expect(deps.enqueueDeploy).toHaveBeenCalledWith({ redisUrl: "redis://x", siteId: "s1" });
  });

  it("re-uploads a hero row whose blobUrl is not R2-hosted", async () => {
    const deps = makeDeps({
      findHeroImage: vi.fn(() =>
        Promise.resolve({ blobUrl: "https://old-cdn.example/legacy.jpg", filename: "legacy.jpg" }),
      ),
      r2PublicBaseUrl: "https://img.easeia.com",
    });

    await makePublishToAstro(deps)({
      post: herolessPost,
      redisUrl: "redis://x",
      site: liveSite,
    });

    expect(deps.fetchImage).toHaveBeenCalledWith("https://old-cdn.example/legacy.jpg");
    expect(deps.upsertPostImage).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "legacy.jpg", isHero: true, postId: "p1" }),
    );
  });

  it("retry case: skips re-upload when an R2 hero row from the same source URL exists", async () => {
    const deps = makeDeps({
      findHeroImage: vi.fn(() =>
        Promise.resolve({
          blobUrl: "https://img.easeia.com/sites/s1/posts/p1/hero.jpg",
          filename: "hero.jpg",
        }),
      ),
      r2PublicBaseUrl: "https://img.easeia.com",
    });

    await makePublishToAstro(deps)({
      post: samplePost,
      redisUrl: "redis://test",
      site: liveSite,
    });

    expect(deps.fetchImage).not.toHaveBeenCalled();
    expect(deps.upsertPostImage).not.toHaveBeenCalled();
    expect(deps.enqueueDeploy).toHaveBeenCalledOnce();
  });

  it("changed-image case: re-uploads when the existing hero row's filename differs", async () => {
    const deps = makeDeps({
      fetchImage: vi.fn(() => Promise.resolve(new Uint8Array([7, 8, 9]))),
      findHeroImage: vi.fn(() =>
        Promise.resolve({
          blobUrl: "https://img.easeia.com/sites/s1/posts/p1/old.jpg",
          filename: "old.jpg",
        }),
      ),
      r2PublicBaseUrl: "https://img.easeia.com",
    });

    await makePublishToAstro(deps)({
      post: samplePost,
      redisUrl: "redis://test",
      site: liveSite,
    });

    expect(deps.fetchImage).toHaveBeenCalledOnce();
    expect(deps.fetchImage).toHaveBeenCalledWith("https://cdn.example/hero.jpg");
    expect(deps.upsertPostImage).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/hero/v),
        isHero: true,
        postId: "p1",
      }),
    );
    expect(deps.enqueueDeploy).toHaveBeenCalledOnce();
  });
});
