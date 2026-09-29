import { describe, expect, it, vi } from "vitest";

const enqueue = vi.fn();
const postGroupBy = vi.fn();
const jobGroupBy = vi.fn();

import {
  bucketConfigErrors,
  createCountBucketSupplyBySite,
  createEnqueueGeneratePosts,
  gatedRefillCount,
  isValidBucketConfig,
  needsRefill,
  REFILL_PER_TICK_CEILING,
} from "./bucket";

const countBucketSupplyBySite = createCountBucketSupplyBySite({
  countDrafts: postGroupBy,
  countInflight: jobGroupBy,
});
const enqueueGeneratePosts = createEnqueueGeneratePosts(enqueue);

describe("gatedRefillCount", () => {
  it("returns the deficit to target when supply is below refillAt", () => {
    expect(gatedRefillCount({ refillAt: 3, supply: 2, target: 10 })).toBe(8);
  });

  it("returns 0 when supply already meets refillAt", () => {
    expect(gatedRefillCount({ refillAt: 3, supply: 3, target: 10 })).toBe(0);
  });

  it("counts in-flight generations as supply", () => {
    expect(gatedRefillCount({ refillAt: 5, supply: 4, target: 10 })).toBe(6);
  });

  it("caps the deficit at the default ceiling", () => {
    expect(gatedRefillCount({ refillAt: 50, supply: 0, target: 100 })).toBe(
      REFILL_PER_TICK_CEILING,
    );
  });

  it("honours an explicit ceiling override", () => {
    expect(gatedRefillCount({ ceiling: 5, refillAt: 50, supply: 0, target: 100 })).toBe(5);
  });

  it("never returns a negative count when supply exceeds target", () => {
    expect(gatedRefillCount({ refillAt: 100, supply: 12, target: 10 })).toBe(0);
  });
});

describe("bucketConfigErrors", () => {
  it("rejects refillAt above target with the shared message", () => {
    expect(bucketConfigErrors({ refillAt: 10, target: 5 })).toEqual([
      "Refill threshold (10) must be ≤ bucket target (5).",
    ]);
    expect(isValidBucketConfig({ refillAt: 10, target: 5 })).toBe(false);
  });

  it("accepts refillAt at or below target", () => {
    expect(bucketConfigErrors({ refillAt: 5, target: 5 })).toEqual([]);
    expect(isValidBucketConfig({ refillAt: 3, target: 10 })).toBe(true);
  });
});

describe("needsRefill", () => {
  it("flags a valid config below its threshold", () => {
    expect(needsRefill({ refillAt: 3, supply: 2, target: 10 })).toBe(true);
  });

  it("does not flag a valid config at or above its threshold", () => {
    expect(needsRefill({ refillAt: 3, supply: 3, target: 10 })).toBe(false);
  });

  it("never flags a config the scan would skip (refillAt > target)", () => {
    expect(needsRefill({ refillAt: 10, supply: 3, target: 5 })).toBe(false);
  });

  it("never flags an unconfigured bucket", () => {
    expect(needsRefill({ refillAt: null, supply: 0, target: 10 })).toBe(false);
    expect(needsRefill({ refillAt: 3, supply: 0, target: null })).toBe(false);
  });
});

describe("countBucketSupplyBySite", () => {
  it("sums drafts and in-flight generations per site, zero-filling absent groups", async () => {
    postGroupBy.mockResolvedValue([{ count: { id: 2 }, siteId: "site_a" }]);
    jobGroupBy.mockResolvedValue([
      { count: { id: 1 }, siteId: "site_a" },
      { count: { id: 4 }, siteId: "site_b" },
    ]);

    const supplies = await countBucketSupplyBySite(["site_a", "site_b", "site_c"]);

    expect(supplies.get("site_a")).toEqual({ drafts: 2, inflight: 1, supply: 3 });
    expect(supplies.get("site_b")).toEqual({ drafts: 0, inflight: 4, supply: 4 });
    expect(supplies.get("site_c")).toBeUndefined();
  });

  it("throws instead of returning a silent zero when a count fails", async () => {
    postGroupBy.mockRejectedValue(new Error("db down"));
    jobGroupBy.mockResolvedValue([]);

    await expect(countBucketSupplyBySite(["site_a"])).rejects.toThrow(/drafts count failed/v);
  });
});

describe("enqueueGeneratePosts", () => {
  it("enqueues one GENERATE_POST job per requested count", async () => {
    enqueue.mockReset();
    await enqueueGeneratePosts({ count: 3, redisUrl: "redis://test", siteId: "site_a" });
    expect(enqueue).toHaveBeenCalledTimes(3);
    expect(enqueue).toHaveBeenCalledWith({
      redisUrl: "redis://test",
      siteId: "site_a",
    });
  });

  it("enqueues nothing when count is 0", async () => {
    enqueue.mockReset();
    await enqueueGeneratePosts({ count: 0, redisUrl: "redis://test", siteId: "site_a" });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
