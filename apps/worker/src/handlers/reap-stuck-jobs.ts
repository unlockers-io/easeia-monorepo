import type { Job } from "@repo/db";
import { reapStuckJobs } from "@repo/jobs/worker";
import { log } from "@repo/observability";

const STUCK_AFTER_MS = 2 * 60 * 60 * 1000;

export const handleReapStuckJobs = async (fail: (job: Job) => Promise<void>): Promise<void> => {
  const reaped = await reapStuckJobs(STUCK_AFTER_MS);

  for (const job of reaped) {
    await fail(job);
  }

  if (reaped.length > 0) {
    log.warn({ message: "reaped stuck jobs", reaped: reaped.length });
  }
};
