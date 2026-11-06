import { prisma } from "@repo/db";
import type { ConsumerContext } from "@repo/jobs";
import { recordGscBacklinks } from "@repo/links";
import { createJobLogger } from "@repo/observability/worker";
import { forSite } from "@repo/search-console";
import { postPublicUrl } from "@repo/sites";

export const handleCrawlGscLinks = async (
  ctx: ConsumerContext<"CRAWL_GSC_LINKS">,
): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "crawl-gsc-links" });
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
    log.warn("crawl-gsc-links: post missing, skipping");
    log.emit();

    return;
  }

  const searchConsole = await forSite(post.site.domain);

  if (searchConsole.status !== "ok") {
    log.set({ searchConsole: searchConsole.status });
    log.warn("crawl-gsc-links: Search Console unavailable, skipping");
    log.emit();

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
  log.emit();
};
