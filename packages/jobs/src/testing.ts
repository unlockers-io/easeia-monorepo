import type { JobKind } from "@repo/db";

import { dispatchPendingJobs } from "./dispatch";
import { queueFor } from "./transport";

export const runDelayedJobsNow = async (kind: JobKind): Promise<void> => {
  await dispatchPendingJobs();
  await queueFor(kind).promoteJobs();
};
