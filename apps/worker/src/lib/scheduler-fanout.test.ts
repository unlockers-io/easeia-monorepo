import { PostStateError } from "@repo/posts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createPublishDueFromBuckets, createRefillLowBuckets } from "./scheduler-fanout";

const findSites = vi.fn();
const publishNextBucketDraft = vi.fn();
const refillConfiguredBuckets = vi.fn();
const publishDueFromBuckets = createPublishDueFromBuckets({ findSites, publishNextBucketDraft });
const refillLowBuckets = createRefillLowBuckets({ refillConfiguredBuckets });
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("publishDueFromBuckets", () => {
  beforeEach(() => {
    findSites.mockReset();
    publishNextBucketDraft.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes the oldest draft when due", async () => {
    findSites.mockResolvedValue([
      {
        cadenceDays: 7,
        domain: "alpha.example.com",
        id: "site_alpha",
        lastAutoPublishedAt: new Date(Date.now() - 8 * MS_PER_DAY),
      },
    ]);
    publishNextBucketDraft.mockResolvedValue({ postId: "post_oldest" });

    await publishDueFromBuckets("redis://test");

    expect(publishNextBucketDraft).toHaveBeenCalledWith("site_alpha", {
      redisUrl: "redis://test",
    });
  });

  it("skips an empty bucket", async () => {
    findSites.mockResolvedValue([
      {
        cadenceDays: 7,
        domain: "alpha.example.com",
        id: "site_alpha",
        lastAutoPublishedAt: null,
      },
    ]);
    publishNextBucketDraft.mockResolvedValue(null);

    await publishDueFromBuckets("redis://test");

    expect(publishNextBucketDraft).toHaveBeenCalledOnce();
  });

  it("treats a lost claim as benign", async () => {
    findSites.mockResolvedValue([
      {
        cadenceDays: 7,
        domain: "alpha.example.com",
        id: "site_alpha",
        lastAutoPublishedAt: null,
      },
    ]);
    publishNextBucketDraft.mockRejectedValue(new PostStateError("claim lost"));

    await publishDueFromBuckets("redis://test");

    expect(publishNextBucketDraft).toHaveBeenCalledWith("site_alpha", {
      redisUrl: "redis://test",
    });
  });

  it("isolates a site publish failure", async () => {
    findSites.mockResolvedValue([
      {
        cadenceDays: 7,
        domain: "alpha.example.com",
        id: "site_alpha",
        lastAutoPublishedAt: null,
      },
    ]);
    publishNextBucketDraft.mockRejectedValue(new Error("redis down"));

    await expect(publishDueFromBuckets("redis://test")).resolves.toBeUndefined();
  });

  it("does nothing when no site is due", async () => {
    findSites.mockResolvedValue([
      {
        cadenceDays: 7,
        domain: "alpha.example.com",
        id: "site_alpha",
        lastAutoPublishedAt: new Date(Date.now() - MS_PER_DAY),
      },
    ]);

    await publishDueFromBuckets("redis://test");

    expect(publishNextBucketDraft).not.toHaveBeenCalled();
  });
});

describe("refillLowBuckets", () => {
  beforeEach(() => {
    refillConfiguredBuckets.mockReset();
  });

  it("runs the configured bucket refill", async () => {
    refillConfiguredBuckets.mockResolvedValue([
      {
        configErrors: [],
        domain: "a.test",
        failures: [],
        queued: 8,
        siteId: "site_a",
        supply: { drafts: 1, inflight: 1, supply: 2 },
      },
    ]);

    await refillLowBuckets("redis://test");

    expect(refillConfiguredBuckets).toHaveBeenCalledWith("redis://test");
  });

  it("accepts an already full bucket", async () => {
    refillConfiguredBuckets.mockResolvedValue([]);

    await refillLowBuckets("redis://test");

    expect(refillConfiguredBuckets).toHaveBeenCalledWith("redis://test");
  });

  it("reports partial enqueue failures without rejecting the tick", async () => {
    refillConfiguredBuckets.mockResolvedValue([
      {
        configErrors: [],
        domain: "a.test",
        failures: [new Error("redis down")],
        queued: 1,
        siteId: "site_a",
        supply: { drafts: 0, inflight: 0, supply: 0 },
      },
    ]);

    await expect(refillLowBuckets("redis://test")).resolves.toBeUndefined();
  });

  it("skips invalid bucket configuration", async () => {
    refillConfiguredBuckets.mockResolvedValue([
      {
        configErrors: ["invalid"],
        domain: "a.test",
        failures: [],
        queued: 0,
        siteId: "site_a",
        supply: { drafts: 3, inflight: 0, supply: 3 },
      },
    ]);

    await refillLowBuckets("redis://test");

    expect(refillConfiguredBuckets).toHaveBeenCalledWith("redis://test");
  });

  it("isolates supply count failures", async () => {
    refillConfiguredBuckets.mockRejectedValue(new Error("database down"));

    await expect(refillLowBuckets("redis://test")).resolves.toBeUndefined();
  });
});
