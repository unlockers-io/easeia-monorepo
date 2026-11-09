import { createFakeBlobStore } from "@repo/blob/fake";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { makeEnsureHero, type EnsureHeroDeps } from "./ensure-hero";

const samplePost = {
  featuredImage: "https://cdn.example/hero.jpg",
  id: "p1",
  siteId: "s1",
  slug: "hello",
  tags: ["tag1"],
  title: "Hello",
};

const herolessPost = {
  featuredImage: null,
  id: "p1",
  siteId: "s1",
  slug: "slug",
  tags: [],
  title: "T",
};

const makeDeps = (overrides: Partial<EnsureHeroDeps> = {}): EnsureHeroDeps => ({
  blob: createFakeBlobStore(),
  fetchImage: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
  generateHero: vi.fn(),
  heroOf: vi.fn(() => Promise.resolve(null)),
  isBlobUrl: () => false,
  setHero: vi.fn(() => Promise.resolve()),
  ...overrides,
});

const liveSite = { imageStyle: "Professional audio studio scene." };

describe("ensureHero", () => {
  it("uploads the hero image to blob and upserts PostImage", async () => {
    const deps = makeDeps();

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: samplePost,
      site: liveSite,
    });

    expect(deps.setHero).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        filename: expect.stringMatching(/^hero/v),
      }),
    );
  });

  it("generates a hero when none exists and autogen is enabled", async () => {
    const deps = makeDeps();
    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: { ...herolessPost, tags: ["t"] },
      site: liveSite,
    });
    expect(deps.generateHero).toHaveBeenCalledExactlyOnceWith({
      post: expect.objectContaining({ id: "p1" }),
      site: { imageStyle: liveSite.imageStyle },
    });
  });

  it("publishes heroless when generation throws", async () => {
    const deps = makeDeps({
      generateHero: vi.fn().mockRejectedValue(new Error("openai down")),
    });

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: herolessPost,
      site: liveSite,
    });
    expect(deps.generateHero).toHaveBeenCalledOnce();
  });

  it("does not generate when a hero already exists", async () => {
    const deps = makeDeps({
      heroOf: vi.fn(() =>
        Promise.resolve({
          blobUrl: "https://img.easeia.com/sites/s1/posts/p1/hero.jpg",
          filename: "hero.jpg",
        }),
      ),
      isBlobUrl: (url: string) => url.startsWith("https://img.easeia.com"),
    });

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: herolessPost,
      site: liveSite,
    });
    expect(deps.generateHero).not.toHaveBeenCalled();
  });

  it("uploads external featuredImage even when r2PublicBaseUrl is set but URL does not match", async () => {
    const deps = makeDeps({
      fetchImage: vi.fn(() => Promise.resolve(new Uint8Array([4, 5, 6]))),
      isBlobUrl: (url: string) => url.startsWith("https://img.easeia.com"),
    });

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: samplePost,
      site: liveSite,
    });

    expect(deps.fetchImage).toHaveBeenCalledOnce();
    expect(deps.fetchImage).toHaveBeenCalledWith("https://cdn.example/hero.jpg");
    expect(deps.setHero).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        filename: expect.stringMatching(/hero/v),
      }),
    );
    expect(deps.generateHero).not.toHaveBeenCalled();
  });

  it("generates when featuredImage is an R2 URL but no hero row backs it", async () => {
    // Regression: this combination previously matched neither branch, so the
    // post published with no hero image, no log, and no error.
    const blob = { upload: vi.fn() };

    const deps = makeDeps({
      blob,
      isBlobUrl: (url: string) => url.startsWith("https://img.easeia.com"),
    });

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: {
        ...herolessPost,
        featuredImage: "https://img.easeia.com/sites/s1/posts/p1/abc.jpg",
      },
      site: liveSite,
    });

    expect(deps.fetchImage).not.toHaveBeenCalled();
    expect(blob.upload).not.toHaveBeenCalled();
    expect(deps.generateHero).toHaveBeenCalledOnce();
  });

  it("re-uploads a hero row whose blobUrl is not R2-hosted", async () => {
    const deps = makeDeps({
      heroOf: vi.fn(() =>
        Promise.resolve({ blobUrl: "https://old-cdn.example/legacy.jpg", filename: "legacy.jpg" }),
      ),
      isBlobUrl: (url: string) => url.startsWith("https://img.easeia.com"),
    });

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: herolessPost,
      site: liveSite,
    });

    expect(deps.fetchImage).toHaveBeenCalledWith("https://old-cdn.example/legacy.jpg");
    expect(deps.setHero).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ filename: "legacy.jpg" }),
    );
  });

  it("retry case: skips re-upload when an R2 hero row from the same source URL exists", async () => {
    const deps = makeDeps({
      heroOf: vi.fn(() =>
        Promise.resolve({
          blobUrl: "https://img.easeia.com/sites/s1/posts/p1/hero.jpg",
          filename: "hero.jpg",
        }),
      ),
      isBlobUrl: (url: string) => url.startsWith("https://img.easeia.com"),
    });

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: samplePost,
      site: liveSite,
    });

    expect(deps.fetchImage).not.toHaveBeenCalled();
    expect(deps.setHero).not.toHaveBeenCalled();
  });

  it("changed-image case: re-uploads when the existing hero row's filename differs", async () => {
    const deps = makeDeps({
      fetchImage: vi.fn(() => Promise.resolve(new Uint8Array([7, 8, 9]))),
      heroOf: vi.fn(() =>
        Promise.resolve({
          blobUrl: "https://img.easeia.com/sites/s1/posts/p1/old.jpg",
          filename: "old.jpg",
        }),
      ),
      isBlobUrl: (url: string) => url.startsWith("https://img.easeia.com"),
    });

    await makeEnsureHero(deps)({
      autogenEnabled: true,
      post: samplePost,
      site: liveSite,
    });

    expect(deps.fetchImage).toHaveBeenCalledOnce();
    expect(deps.fetchImage).toHaveBeenCalledWith("https://cdn.example/hero.jpg");
    expect(deps.setHero).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        filename: expect.stringMatching(/hero/v),
      }),
    );
  });
});
