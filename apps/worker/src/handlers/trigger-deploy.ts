import { deploy } from "@repo/sites";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

export const handleTriggerDeploy = async ({
  log,
  payload,
}: JobContext<"TRIGGER_DEPLOY">): Promise<void> => {
  const { siteId } = payload;
  log.set({ siteId });
  const outcome = await deploy(prisma, siteId, fetch);
  log.set({ outcome });
  log.info("trigger-deploy: done");
};
