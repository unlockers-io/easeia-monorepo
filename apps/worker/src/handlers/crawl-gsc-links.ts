import { prisma } from "@repo/db";
import { JobSkippedError } from "@repo/jobs";
import { recordGscBacklinks } from "@repo/links";
import { forSite } from "@repo/search-console";
import { postPublicUrl } from "@repo/sites";

import type { JobContext } from "../lib/job-log";

export const handleCrawlGscLinks = async ({
  log,
  payload,
}: JobContext<"CRAWL_GSC_LINKS">): Promise<void> => {
  log.set({ postId: payload.postId });

  const post = await prisma.post.findUnique({
    select: {
      categories: true,
      id: true,
      site: { select: { categorySlugMap: true, defaultCategory: true, domain: true } },
      siteId: true,
      slug: true,
    },
    where: { id: payload.postId },
  });

  if (!post) {
    throw new JobSkippedError("Post no longer exists");
  }

  const searchConsole = await forSite(post.site.domain);

  if (searchConsole.status !== "ok") {
    log.set({ searchConsole: searchConsole.status });
    log.warn("crawl-gsc-links: Search Console unavailable, skipping");

    return;
  }

  const result = await searchConsole.inspectUrl(postPublicUrl(post.site, post));
  const { domains } = await recordGscBacklinks(post, result.referringUrls);

  log.set({
    coverageState: result.coverageState,
    domains,
    referringUrls: result.referringUrls.length,
    siteId: post.siteId,
  });
  log.info("crawl-gsc-links: done");
};
