import { JobKind, prisma } from "@repo/db";
import { enqueue, type ConsumerContext } from "@repo/jobs";
import { crawlSitemap } from "@repo/money-sites";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";
import { settleFanout } from "../lib/settle-fanout";

export const handleCrawlMoneySite = async (
  ctx: ConsumerContext<"CRAWL_MONEY_SITE">,
): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "crawl-money-site" });
  const result = await crawlSitemap(payload.moneySiteId);
  // eslint-disable-next-line react-doctor/server-sequential-independent-await -- not independent: findMany reads the pages crawlSitemap just upserted
  const pages = await prisma.moneySitePage.findMany({
    select: { id: true },
    where: { moneySiteId: payload.moneySiteId },
  });
  log.set({
    discovered: result.discovered,
    moneySiteId: payload.moneySiteId,
    upserted: result.upserted,
  });
  await settleFanout(
    pages.map((p) => ({
      id: p.id,
      run: async () => {
        await enqueue({
          kind: JobKind.CRAWL_MONEY_SITE_PAGE,
          payload: { moneySitePageId: p.id },
          redisUrl: env.REDIS_URL,
        });
      },
    })),
    "crawl-money-site: page enqueue failed",
    log,
  );
  // settleFanout throws on any rejection, so reaching here means all landed.
  log.set({ enqueued: pages.length });
  log.info("crawl-money-site: done");
  log.emit();
};
