import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { makeBackfillHeroes } from "./hero-backfill-fanout";

describe("backfillHeroes", () => {
  it("enqueues one GENERATE_IMAGE per heroless post", async () => {
    const enqueueJob = vi.fn().mockResolvedValue({ id: "j" });
    const backfill = makeBackfillHeroes({
      enqueueJob,
      findHeroless: () =>
        Promise.resolve([
          { id: "p1", siteId: "s1" },
          { id: "p2", siteId: "s2" },
        ]),
    });
    const result = await backfill("redis://x");
    expect(result.enqueued).toBe(2);
    expect(enqueueJob).toHaveBeenCalledTimes(2);
  });

  it("no-ops when nothing is heroless", async () => {
    const enqueueJob = vi.fn();
    const backfill = makeBackfillHeroes({ enqueueJob, findHeroless: () => Promise.resolve([]) });
    const result = await backfill("redis://x");
    expect(result.enqueued).toBe(0);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("tolerates partial enqueue failures and counts only successes", async () => {
    const enqueueJob = vi
      .fn()
      .mockRejectedValueOnce(new Error("redis"))
      .mockResolvedValueOnce({ id: "j" });
    const backfill = makeBackfillHeroes({
      enqueueJob,
      findHeroless: () =>
        Promise.resolve([
          { id: "p1", siteId: "s1" },
          { id: "p2", siteId: "s2" },
        ]),
    });
    const result = await backfill("redis://x");
    expect(result.enqueued).toBe(1);
  });
});
