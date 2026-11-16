import type { JobKind, PrismaClient } from "@repo/db";

import { dispatchPendingJobs } from "./dispatch";
import { queueFor } from "./transport";

export const runDelayedJobsNow = async (prisma: PrismaClient, kind: JobKind): Promise<void> => {
  await dispatchPendingJobs(prisma);
  await queueFor(kind).promoteJobs();
};
