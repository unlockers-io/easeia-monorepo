import { JobStatus, prisma } from "@repo/db";

import { describeError, queueFor } from "./queue";

const RECHECK_MS = 30_000;

export const dispatchPendingJobs = async (): Promise<void> => {
  const now = new Date();

  const rows = await prisma.job.findMany({
    orderBy: [{ dispatchedAt: { nulls: "first", sort: "asc" } }, { createdAt: "asc" }],
    take: 100,
    where: {
      OR: [{ dispatchedAt: null }, { dispatchedAt: { lt: new Date(Date.now() - RECHECK_MS) } }],
      status: JobStatus.QUEUED,
    },
  });

  for (const row of rows) {
    try {
      const queue = queueFor(row.kind);
      const existing = await queue.getJob(row.id);
      const state = await existing?.getState();

      if (state === "completed" || state === "failed") {
        await prisma.job.updateMany({
          data: {
            dispatchedAt: now,
            finishedAt: now,
            lastError: state === "failed" ? existing?.failedReason : null,
            status: state === "completed" ? JobStatus.DONE : JobStatus.FAILED,
          },
          where: { id: row.id, status: JobStatus.QUEUED },
        });
        continue;
      }

      if (existing === undefined) {
        await queue.add(row.kind.toLowerCase(), row.payload, {
          attempts: Math.max(1, 5 - row.attempts),
          delay: Math.max(0, row.availableAt.getTime() - Date.now()),
          jobId: row.id,
        });
      }

      await prisma.job.updateMany({
        data: { dispatchedAt: now, queueJobId: row.id },
        where: { id: row.id, status: JobStatus.QUEUED },
      });
    } catch (error) {
      await prisma.job.updateMany({
        data: { dispatchedAt: now, lastError: describeError(error) },
        where: { id: row.id, status: JobStatus.QUEUED },
      });
    }
  }
};
