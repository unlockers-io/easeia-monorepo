/**
 * CRAWL_LINKS adapter at the Job seam. All Link extraction,
 * classification, and persistence lives in `@repo/links`. This handler
 * just translates the job payload into a module call.
 */
import { prisma } from "@repo/db";
import { enqueueTriggerDeploy, type ConsumerContext } from "@repo/jobs";
import { crawlPost } from "@repo/links";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";

export const handleCrawlLinks = async (ctx: ConsumerContext<"CRAWL_LINKS">): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "crawl-links" });
  log.set({ postId: payload.postId });
  const summary = await crawlPost(payload.postId);
  if (!summary) {
    log.info("crawl-links: nothing to crawl");
    log.emit();
    return;
  }

  const targets = await prisma.link.findMany({
    select: { toPost: { select: { siteId: true } } },
    where: { fromPostId: payload.postId, toPost: { isNot: null } },
  });
  const siteIds = targets.map((t) => t.toPost?.siteId).filter((s): s is string => s !== undefined);
  const uniqueSiteIds = [...new Set(siteIds)];
  const deployResults = await Promise.allSettled(
    uniqueSiteIds.map((siteId) => enqueueTriggerDeploy({ redisUrl: env.REDIS_URL, siteId })),
  );
  const deploysEnqueued = deployResults.filter(
    (r) => r.status === "fulfilled" && !r.value.skipped,
  ).length;

  log.set({ deploysEnqueued, ...summary });
  log.info("crawl-links: done");
  log.emit();
};
