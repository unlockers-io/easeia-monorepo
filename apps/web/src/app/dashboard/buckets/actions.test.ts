import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRefillAllNeedyBucketsAction } from "./refill-all-action";

const refillConfiguredBuckets = vi.fn();
const refillAllNeedyBucketsAction = createRefillAllNeedyBucketsAction({
  aiConfigured: () => true,
  getRedisUrl: () => "redis://test",
  logFailures: () => {},
  refillBuckets: refillConfiguredBuckets,
  requireSession: vi.fn().mockResolvedValue({ user: { id: "user_1" } }),
  revalidate: () => {},
});

describe("refillAllNeedyBucketsAction", () => {
  beforeEach(() => {
    refillConfiguredBuckets.mockReset();
  });

  it("skips a site the worker scan would skip (refillAt > target)", async () => {
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

    const result = await refillAllNeedyBucketsAction();

    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.sitesTouched).toBe(0);
  });

  it("refills a validly configured site below its threshold", async () => {
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

    const result = await refillAllNeedyBucketsAction();

    expect(refillConfiguredBuckets).toHaveBeenCalledWith("redis://test");
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.queuedPerSite).toEqual({ site_a: 8 });
  });
});

it("does not queue or read Redis when AI is unconfigured", async () => {
  const getRedisUrl = vi.fn();
  const refillBuckets = vi.fn();
  const requireSession = vi.fn().mockResolvedValue(undefined);
  const action = createRefillAllNeedyBucketsAction({
    aiConfigured: () => false,
    getRedisUrl,
    logFailures: () => {},
    refillBuckets,
    requireSession,
    revalidate: () => {},
  });
  expect(await action()).toEqual({ error: expect.stringContaining("OPENAI_API_KEY"), ok: false });
  expect(requireSession).toHaveBeenCalledOnce();
  expect(refillBuckets).not.toHaveBeenCalled();
  expect(getRedisUrl).not.toHaveBeenCalled();
});
