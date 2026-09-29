import { JobStatus } from "@repo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createReapStuckJobs, type UpdateJobs } from "./index";

type ReapWhere = {
  OR: Array<{
    attempts?: { gt: number };
    startedAt: { lt: Date; not: null };
    status: string;
  }>;
};

const updateMany = vi.fn<UpdateJobs>(() => Promise.resolve({ count: 0 }));
const reapStuckJobs = createReapStuckJobs(updateMany);

/** The `where` the reaper would send, so the clauses can be asserted directly. */
const capturedWhere = (): ReapWhere => {
  const call = updateMany.mock.calls[0];
  if (call === undefined) {
    throw new Error("reapStuckJobs did not call updateMany");
  }
  return call[0].where as ReapWhere;
};

describe("reapStuckJobs", () => {
  beforeEach(() => {
    updateMany.mockClear();
  });

  it("keys both clauses on startedAt, never createdAt", async () => {
    await reapStuckJobs(60_000);
    const where = capturedWhere();

    expect(JSON.stringify(where)).not.toContain("createdAt");
    for (const clause of where.OR) {
      expect(clause.startedAt).toEqual({ lt: expect.any(Date), not: null });
    }
  });

  it("reaps RUNNING jobs that started before the cutoff", async () => {
    await reapStuckJobs(60_000);
    const running = capturedWhere().OR.find((c) => c.status === JobStatus.RUNNING);

    expect(running).toBeDefined();
    expect(running?.attempts).toBeUndefined();
  });

  it("reaps QUEUED jobs only when they have already attempted at least once", async () => {
    // A delayed job that has never run has attempts 0 and startedAt null, so
    // this clause must not be able to match it.
    await reapStuckJobs(60_000);
    const queued = capturedWhere().OR.find((c) => c.status === JobStatus.QUEUED);

    expect(queued).toBeDefined();
    expect(queued?.attempts).toEqual({ gt: 0 });
    expect(queued?.startedAt.not).toBeNull();
  });

  it("uses the supplied max age to build the cutoff", async () => {
    const before = Date.now();
    await reapStuckJobs(3_600_000);
    const cutoff = capturedWhere().OR[0]?.startedAt.lt ?? new Date(0);

    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(3_600_000);
    expect(before - cutoff.getTime()).toBeLessThan(3_605_000);
  });

  it("returns the number of rows the update touched", async () => {
    updateMany.mockResolvedValueOnce({ count: 7 });
    await expect(reapStuckJobs()).resolves.toEqual({ reaped: 7 });
  });
});
