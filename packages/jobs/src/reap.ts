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
      // Delayed jobs can be old before their first attempt, so creation age
      // cannot distinguish a scheduled job from a stuck job.
      OR: [
        { startedAt: { lt: cutoff, not: null }, status: JobStatus.RUNNING },
        // A queued job with a recorded attempt lost its BullMQ retry. The
        // attempts check excludes jobs waiting for their initial delay.
        {
          attempts: { gt: 0 },
          startedAt: { lt: cutoff, not: null },
          status: JobStatus.QUEUED,
        },
      ],
    },
  });
  return { reaped: result.count };
};
