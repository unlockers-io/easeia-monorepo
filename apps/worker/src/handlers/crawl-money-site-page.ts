import type { ConsumerContext } from "@repo/jobs";
import { crawlPage } from "@repo/money-sites";

import { createJobLogger } from "../lib/logger";

export const handleCrawlMoneySitePage = async (
  ctx: ConsumerContext<"CRAWL_MONEY_SITE_PAGE">,
): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "crawl-money-site-page" });
  const result = await crawlPage(payload.moneySitePageId);
  log.set({ moneySitePageId: payload.moneySitePageId, ...result });
  log.info("crawl-money-site-page: done");
  log.emit();
};
