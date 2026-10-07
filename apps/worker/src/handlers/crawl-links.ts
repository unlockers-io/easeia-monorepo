import type { ConsumerContext } from "@repo/jobs";
import { crawlPost } from "@repo/links";

import { createJobLogger } from "../lib/logger";

export const handleCrawlLinks = async (ctx: ConsumerContext<"CRAWL_LINKS">): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "crawl-links" });
  log.set({ postId: payload.postId });
  const summary = await crawlPost(payload.postId);
  if (summary) {
    log.set(summary);
  }
  log.info(summary ? "crawl-links: done" : "crawl-links: nothing to crawl");
  log.emit();
};
