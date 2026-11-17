import * as Sites from "@repo/sites";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

export const handleRequestSnapshots = async ({
  log,
}: JobContext<"REQUEST_SNAPSHOTS">): Promise<void> => {
  const { queued } = await Sites.requestSnapshots(prisma);
  log.set({ queued });
  log.info("snapshots requested");
};
