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
  categories: [],
  id: "p1",
  site: { imageStyle: "Professional audio studio scene." },
  siteId: "s1",
  slug: "slug",
  tags: [],
  title: "T",
};

describe("handleGenerateImage", () => {
  it("generates a hero and enqueues a deploy when none exists", async () => {
    const generateHero = vi.fn().mockResolvedValue({ key: "k", url: "u" });
    const enqueueTriggerDeploy = vi.fn().mockResolvedValue({ skipped: false });
    const handle = makeHandleGenerateImage({
      enqueueTriggerDeploy,
      findPost: () => Promise.resolve(post),
      generateHero,
      hasHero: () => Promise.resolve(false),
      redisUrl: "redis://x",
    });
    await handle({ attemptsMade: 0, finalAttempt: false, jobId: "j", payload: { postId: "p1" } });
    expect(generateHero).toHaveBeenCalledExactlyOnceWith({
      post: expect.objectContaining({ id: "p1" }),
      site: { imageStyle: post.site.imageStyle },
    });
    expect(enqueueTriggerDeploy).toHaveBeenCalledWith({ redisUrl: "redis://x", siteId: "s1" });
  });

  it("is idempotent: skips generation when a hero already exists", async () => {
    const generateHero = vi.fn();
    const enqueueTriggerDeploy = vi.fn().mockResolvedValue({ skipped: true });
    const handle = makeHandleGenerateImage({
      enqueueTriggerDeploy,
      findPost: () => Promise.resolve(post),
      generateHero,
      hasHero: () => Promise.resolve(true),
      redisUrl: "redis://x",
    });
    await handle({ attemptsMade: 0, finalAttempt: false, jobId: "j", payload: { postId: "p1" } });
    expect(generateHero).not.toHaveBeenCalled();
  });
});
