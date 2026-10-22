import { JobStatus, prisma } from "@repo/db";

export const reapStuckJobs = async (maxAgeMs = 30 * 60 * 1000): Promise<{ reaped: number }> => {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const result = await prisma.job.updateMany({
    data: {
      finishedAt: new Date(),
      lastError: "stuck: reaped by reconciliation",
      status: JobStatus.FAILED,
    },
    where: {
      startedAt: { lt: cutoff, not: null },
      status: JobStatus.RUNNING,
    },
  });

  return { reaped: result.count };
};
