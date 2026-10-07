import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRefillAllNeedyBuckets } from "./refill-all-action";

const refillConfiguredBuckets = vi.fn();
const refillAllNeedyBuckets = createRefillAllNeedyBuckets({
  audit: () => Promise.resolve(),
  logFailures: () => {},
  refillBuckets: refillConfiguredBuckets,
  revalidate: () => {},
});

describe("refillAllNeedyBuckets", () => {
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

    const result = await refillAllNeedyBuckets();

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

    const result = await refillAllNeedyBuckets();

    expect(refillConfiguredBuckets).toHaveBeenCalledOnce();
    expect(result.queuedPerSite).toEqual({ site_a: 8 });
  });
});
