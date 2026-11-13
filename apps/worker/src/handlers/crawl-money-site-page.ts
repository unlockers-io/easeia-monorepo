import { crawlPage } from "@repo/money-sites";

import type { JobContext } from "../lib/job-log";

export const handleCrawlMoneySitePage = async ({
  log,
  payload,
}: JobContext<"CRAWL_MONEY_SITE_PAGE">): Promise<void> => {
  const result = await crawlPage(payload.moneySitePageId);
  log.set({ moneySitePageId: payload.moneySitePageId, ...result });
  log.info("crawl-money-site-page: done");
};
