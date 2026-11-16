import * as AutoPublish from "@repo/auto-publish";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

export const handleAutoPublish = async ({ log }: JobContext<"AUTO_PUBLISH">): Promise<void> => {
  const { published, refills, skipped } = await AutoPublish.tick(prisma);
  log.set({
    published,
    refilled: refills.filter((refill) => refill.queued > 0),
    skipped,
  });
  log.info("auto-publish: tick");
};
