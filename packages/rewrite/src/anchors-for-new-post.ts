import type { Niche } from "@repo/db";
import { prisma } from "@repo/db";
import { postPublicUrl } from "@repo/sites";

import type { AnchorSpec } from "./prompt";

const TOP_MONEY_SITE = 2;
const TOP_INTERNAL_PBN = 2;

export type AnchorsForNewPostInput = {
  niches: ReadonlyArray<Niche>;
  siteId: string;
};

const truncateAnchorText = (text: string, max = 60): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

export const selectAnchorsForNewPost = async (
  input: AnchorsForNewPostInput,
): Promise<Array<AnchorSpec>> => {
  const site = await prisma.site.findUnique({
    include: { moneySite: { select: { name: true } } },
    where: { id: input.siteId },
  });
  if (!site) {
    return [];
  }

  const [peerPosts, moneyPages] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        categories: true,
        id: true,
        niches: true,
        site: { select: { categorySlugMap: true, defaultCategory: true, domain: true } },
        slug: true,
        title: true,
      },
      // Site.domain is @unique and Post is @@unique([siteId, slug]), so two
      // rows cannot yield the same public URL. The old 4x overfetch existed to
      // give a dedupe headroom, but the slice ran before the dedupe, so it only
      // ever fetched and discarded peer posts.
      take: TOP_INTERNAL_PBN,
      where: {
        niches: input.niches.length > 0 ? { hasSome: [...input.niches] } : undefined,
        site: { language: site.language },
        siteId: { not: input.siteId },
        status: "PUBLISHED",
      },
    }),
    site.moneySiteId !== null && site.moneySiteId !== ""
      ? prisma.moneySitePage.findMany({
          orderBy: [{ lastCrawledAt: "desc" }, { createdAt: "desc" }],
          select: { title: true, url: true },
          take: TOP_MONEY_SITE,
          where: {
            moneySiteId: site.moneySiteId,
            niches: input.niches.length > 0 ? { hasSome: [...input.niches] } : undefined,
          },
        })
      : Promise.resolve([]),
  ]);

  const anchors: Array<AnchorSpec> = [];

  for (const page of moneyPages) {
    anchors.push({
      anchor: truncateAnchorText(page.title),
      reason: `${site.moneySite?.name ?? "Money site"} page: ${page.title}`,
      url: page.url,
    });
  }

  for (const post of peerPosts) {
    const url = postPublicUrl(post.site, post);
    anchors.push({
      anchor: truncateAnchorText(post.title),
      reason: `Internal/PBN link to "${post.title}" on ${post.site.domain}`,
      url,
    });
  }

  return anchors;
};
