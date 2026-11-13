import { crawlPost } from "@repo/links";

import type { JobContext } from "../lib/job-log";

export const handleCrawlLinks = async ({
  log,
  payload,
}: JobContext<"CRAWL_LINKS">): Promise<void> => {
  log.set({ postId: payload.postId });
  const summary = await crawlPost(payload.postId);

  if (summary) {
    log.set(summary);
  }

  log.info(summary ? "crawl-links: done" : "crawl-links: nothing to crawl");
};
