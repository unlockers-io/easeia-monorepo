import type { Job } from "@repo/db";
import { reapStuckJobs } from "@repo/jobs/worker";

import type { JobLog } from "../lib/job-log";

const STUCK_AFTER_MS = 2 * 60 * 60 * 1000;

export const handleReapStuckJobs = async (
  log: JobLog,
  fail: (job: Job) => Promise<void>,
): Promise<void> => {
  const reaped = await reapStuckJobs(STUCK_AFTER_MS);

  for (const job of reaped) {
    await fail(job);
  }

  log.set({ reaped: reaped.length });

  if (reaped.length > 0) {
    log.warn("reaped stuck jobs");
  }
};
