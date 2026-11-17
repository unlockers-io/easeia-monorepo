import { crawlSitemap } from "@repo/money-sites";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

export const handleCrawlMoneySite = async ({
  log,
  payload,
  run,
}: JobContext<"CRAWL_MONEY_SITE">): Promise<void> => {
  const result = await crawlSitemap(prisma, payload.moneySiteId, run);

  log.set({ moneySiteId: payload.moneySiteId, ...result });
  log.info("crawl-money-site: done");
};
