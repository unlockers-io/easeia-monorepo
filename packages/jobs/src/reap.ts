import { type Job, JobStatus, prisma } from "@repo/db";

export const reapStuckJobs = async (maxAgeMs: number): Promise<Array<Job>> =>
  prisma.job.updateManyAndReturn({
    data: {
      finishedAt: new Date(),
      lastError: "stuck: reaped by reconciliation",
      status: JobStatus.FAILED,
    },
    where: {
      startedAt: { lt: new Date(Date.now() - maxAgeMs), not: null },
      status: JobStatus.RUNNING,
    },
  });
