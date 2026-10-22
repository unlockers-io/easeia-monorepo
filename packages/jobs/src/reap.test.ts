import { JobKind, JobStatus, prisma } from "@repo/db";
import { afterAll, describe, expect, it } from "vitest";

import { reapStuckJobs } from "./index";

const HOUR_MS = 60 * 60 * 1000;

describe.runIf(process.env.TEST_DATABASE === "true")("reapStuckJobs", () => {
  const createdIds: Array<string> = [];

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: createdIds } } });
  });

  const seed = async (row: { attempts: number; startedAt: Date | null; status: JobStatus }) => {
    const job = await prisma.job.create({
      data: {
        ...row,
        createdAt: new Date(Date.now() - 3 * HOUR_MS),
        kind: JobKind.CRAWL_LINKS,
        payload: { postId: "post_unused" },
      },
    });

    createdIds.push(job.id);

    return job.id;
  };

  it("fails stale RUNNING rows and leaves the rest alone", async () => {
    const stale = new Date(Date.now() - 2 * HOUR_MS);
    const fresh = new Date();
    const staleRunning = await seed({ attempts: 1, startedAt: stale, status: JobStatus.RUNNING });
    const staleRetry = await seed({ attempts: 2, startedAt: stale, status: JobStatus.QUEUED });
    const freshRunning = await seed({ attempts: 1, startedAt: fresh, status: JobStatus.RUNNING });
    const freshRetry = await seed({ attempts: 1, startedAt: fresh, status: JobStatus.QUEUED });
    const delayed = await seed({ attempts: 0, startedAt: null, status: JobStatus.QUEUED });
    const finished = await seed({ attempts: 1, startedAt: stale, status: JobStatus.DONE });

    const { reaped } = await reapStuckJobs(HOUR_MS);
    const rows = await prisma.job.findMany({ where: { id: { in: createdIds } } });
    const statusOf = new Map(rows.map((row) => [row.id, row.status]));

    expect(reaped).toBeGreaterThanOrEqual(1);
    expect(statusOf.get(staleRunning)).toBe(JobStatus.FAILED);
    expect(statusOf.get(staleRetry)).toBe(JobStatus.QUEUED);
    expect(statusOf.get(freshRunning)).toBe(JobStatus.RUNNING);
    expect(statusOf.get(freshRetry)).toBe(JobStatus.QUEUED);
    expect(statusOf.get(delayed)).toBe(JobStatus.QUEUED);
    expect(statusOf.get(finished)).toBe(JobStatus.DONE);
    expect(rows.find((row) => row.id === staleRunning)?.lastError).toBe(
      "stuck: reaped by reconciliation",
    );
  });
});
