import type { ConsumerContext } from "@repo/jobs";
import { crawlSitemap } from "@repo/money-sites";
import { createJobLogger } from "@repo/observability/worker";

export const handleCrawlMoneySite = async (
  ctx: ConsumerContext<"CRAWL_MONEY_SITE">,
): Promise<void> => {
  const { jobId, payload, run } = ctx;
  const log = createJobLogger({ jobId, queue: "crawl-money-site" });
  const result = await crawlSitemap(payload.moneySiteId, run);

  log.set({ moneySiteId: payload.moneySiteId, ...result });
  log.info("crawl-money-site: done");
  log.emit();
};
