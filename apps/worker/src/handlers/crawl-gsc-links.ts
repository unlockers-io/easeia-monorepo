import { ExternalBacklinkSource, prisma } from "@repo/db";
import type { ConsumerContext } from "@repo/jobs";
import { inspectUrl } from "@repo/search-console";
import { postPublicUrl } from "@repo/sites";

import { buildRedirectUri } from "../lib/google-redirect-uri";
import { createJobLogger } from "../lib/logger";

export const extractSourceDomain = (rawUrl: string): string | null => {
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./v, "").toLowerCase();
  } catch {
    return null;
  }
};

/** Distinct referring pages per source domain. Pure, so it is testable without a DB. */
export const aggregateByDomain = (
  rows: ReadonlyArray<{ referringUrl: string }>,
): Map<string, Set<string>> => {
  const pagesByDomain = new Map<string, Set<string>>();
  for (const row of rows) {
    const domain = extractSourceDomain(row.referringUrl);
    if (domain === null || domain === "") {
      continue;
    }
    const set = pagesByDomain.get(domain) ?? new Set<string>();
    set.add(row.referringUrl);
    pagesByDomain.set(domain, set);
  }
  return pagesByDomain;
};

const reaggregateForSite = async (
  siteId: string,
  observed: ReadonlySet<string>,
): Promise<{ domains: number }> => {
  if (observed.size === 0) {
    return { domains: 0 };
  }
  const all = await prisma.gscReferringUrl.findMany({
    select: { referringUrl: true },
    where: { siteId },
  });

  const pagesByDomain = new Map(
    [...aggregateByDomain(all).entries()].filter(([domain]) => observed.has(domain)),
  );

  await Promise.allSettled(
    [...pagesByDomain.entries()].map(([domain, pages]) =>
      prisma.externalBacklink.upsert({
        create: {
          linkingPages: pages.size,
          siteId,
          source: ExternalBacklinkSource.GSC_API,
          sourceDomain: domain,
        },
        update: {
          importedAt: new Date(),
          linkingPages: pages.size,
        },
        where: {
          siteId_sourceDomain_source: {
            siteId,
            source: ExternalBacklinkSource.GSC_API,
            sourceDomain: domain,
          },
        },
      }),
    ),
  );

  return { domains: pagesByDomain.size };
};

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

  // Astro sites serve each post at https://{domain}/{categorySlug}/{slug}/
  // (Post.link was dropped with the WordPress→Astro migration).
  const inspectionUrl = postPublicUrl(post.site, post);

  const redirectUri = buildRedirectUri();
  if (redirectUri === null || redirectUri === "") {
    log.warn("crawl-gsc-links: APP_URL unset, skipping");
    log.emit();
    return;
  }

  const result = await inspectUrl(
    { redirectUri, userId: payload.userId },
    { inspectionUrl, sitePropertyUrl: payload.sitePropertyUrl },
  );

  if (result.referringUrls.length > 0) {
    await Promise.allSettled(
      result.referringUrls.map((referringUrl) =>
        prisma.gscReferringUrl.upsert({
          create: {
            referringUrl,
            siteId: post.siteId,
            toPostId: post.id,
          },
          update: { observedAt: new Date() },
          where: {
            siteId_toPostId_referringUrl: {
              referringUrl,
              siteId: post.siteId,
              toPostId: post.id,
            },
          },
        }),
      ),
    );
  }

  const observedDomains = new Set(
    result.referringUrls
      .map((u) => extractSourceDomain(u))
      .filter((d): d is string => d !== null && d !== ""),
  );
  const agg = await reaggregateForSite(post.siteId, observedDomains);

  log.set({
    coverageState: result.coverageState,
    domains: agg.domains,
    referringUrls: result.referringUrls.length,
    siteId: post.siteId,
  });
  log.info("crawl-gsc-links: done");
  log.emit();
};
