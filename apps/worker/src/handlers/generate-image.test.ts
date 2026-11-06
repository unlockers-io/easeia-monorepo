import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { makeHandleGenerateImage } from "./generate-image";

const post = {
  id: "p1",
  site: { imageStyle: "Professional audio studio scene." },
  siteId: "s1",
  slug: "slug",
  tags: [],
  title: "T",
};

describe("handleGenerateImage", () => {
  it("generates a hero when none exists", async () => {
    const generateHero = vi.fn().mockResolvedValue(undefined);

    const handle = makeHandleGenerateImage({
      findPost: () => Promise.resolve(post),
      generateHero,
      heroOf: () => Promise.resolve(null),
    });

    await handle({ jobId: "j", payload: { postId: "p1" } });
    expect(generateHero).toHaveBeenCalledExactlyOnceWith({
      post: expect.objectContaining({ id: "p1" }),
      site: { imageStyle: post.site.imageStyle },
    });
  });

  it("is idempotent: skips generation when a hero already exists", async () => {
    const generateHero = vi.fn();

    const handle = makeHandleGenerateImage({
      findPost: () => Promise.resolve(post),
      generateHero,
      heroOf: () => Promise.resolve({ blobUrl: "https://img.test/h.jpg", filename: "h.jpg" }),
    });

    await handle({ jobId: "j", payload: { postId: "p1" } });
    expect(generateHero).not.toHaveBeenCalled();
  });
});
