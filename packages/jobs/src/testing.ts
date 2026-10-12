import type { JobKind } from "@repo/db";

import { queueFor } from "./queue";

export const runDelayedJobsNow = async (kind: JobKind): Promise<void> => {
  await queueFor(kind).promoteJobs();
};
