import { LinkSource, LinkStatus, LinkType, prisma } from "@repo/db";

import { classifyLinks, type ClassifiedLink, type ResolvedLink } from "./classify";
import { extractFromHtml } from "./extract";
import { fabricatedHrefs, stripAnchors } from "./prune";

export { classifyLinks, type ClassifiedLink, type NetworkSite } from "./classify";
export { extractFromHtml, type ExtractedLink } from "./extract";
export { isLiveLink, liveLinkWhere } from "./live";
export { fabricatedHrefs, stripAnchor, stripAnchors } from "./prune";

export type CrawlSummary = {
  external: number;
  internal: number;
  pbn: number;
  total: number;
};

const MAX_ANCHOR_LENGTH = 500;
const MAX_URL_LENGTH = 2000;

const resolveToPostIds = async (
  classified: ReadonlyArray<ClassifiedLink>,
): Promise<Array<ResolvedLink>> => {
  const candidatesBySite = new Map<string, Set<string>>();
  for (const link of classified) {
    if (link.toSiteId === null || link.slug === null) {
      continue;
    }
    const set = candidatesBySite.get(link.toSiteId) ?? new Set();
    set.add(link.slug);
    candidatesBySite.set(link.toSiteId, set);
  }

  const lookups = await Promise.all(
    [...candidatesBySite].map(async ([siteId, slugs]) => ({
      matches: await prisma.post.findMany({
        select: { id: true, slug: true },
        where: { siteId, slug: { in: [...slugs] } },
      }),
      siteId,
    })),
  );

  const lookup = new Map<string, string>();
  for (const { matches, siteId } of lookups) {
    for (const m of matches) {
      lookup.set(`${siteId}|${m.slug}`, m.id);
    }
  }
  return classified.map((link) => ({
    ...link,
    toPostId:
      link.toSiteId !== null && link.slug !== null
        ? (lookup.get(`${link.toSiteId}|${link.slug}`) ?? null)
        : null,
  }));
};

export const crawlPost = async (postId: string): Promise<CrawlSummary | null> => {
  const post = await prisma.post.findUnique({
    include: { site: true },
    where: { id: postId },
  });
  if (post === null || post.body === "") {
    return null;
  }

  const sites = await prisma.site.findMany({ select: { domain: true, id: true } });
  const extracted = extractFromHtml(post.body);
  const base = `https://${post.site.domain}`;
  const classified = classifyLinks({
    base,
    links: extracted,
    network: sites,
    ownSiteDomain: post.site.domain,
    ownSiteId: post.siteId,
  });
  const resolved = await resolveToPostIds(classified);

  const rows = resolved.map((link) => ({
    anchorText: link.anchorText.slice(0, MAX_ANCHOR_LENGTH),
    fromPostId: post.id,
    lastCheckedAt: new Date(),
    position: link.position,
    rel: link.rel,
    source: LinkSource.IMPORTED,
    status: LinkStatus.ACTIVE,
    toPostId: link.toPostId,
    toUrl: link.href.slice(0, MAX_URL_LENGTH),
    type: link.type,
  }));

  const materializedTargets = [
    ...new Set(rows.map((r) => r.toPostId).filter((id): id is string => id !== null)),
  ];

  await prisma.$transaction([
    prisma.link.deleteMany({ where: { fromPostId: post.id, source: LinkSource.IMPORTED } }),
    ...(materializedTargets.length > 0
      ? [
          prisma.link.deleteMany({
            where: {
              approved: true,
              fromPostId: post.id,
              source: LinkSource.SUGGESTED,
              toPostId: { in: materializedTargets },
            },
          }),
        ]
      : []),
    ...(rows.length > 0 ? [prisma.link.createMany({ data: rows })] : []),
  ]);

  return {
    external: rows.filter((r) => r.type === LinkType.EXTERNAL).length,
    internal: rows.filter((r) => r.type === LinkType.INTERNAL).length,
    pbn: rows.filter((r) => r.type === LinkType.PBN).length,
    total: rows.length,
  };
};

export const pruneFabricatedLinks = async (
  postId: string,
): Promise<{ stripped: Array<string> }> => {
  const post = await prisma.post.findUnique({
    include: { site: { select: { domain: true } } },
    where: { id: postId },
  });
  if (post === null || post.body === "") {
    return { stripped: [] };
  }
  const sites = await prisma.site.findMany({ select: { domain: true, id: true } });
  const classified = classifyLinks({
    base: `https://${post.site.domain}`,
    links: extractFromHtml(post.body),
    network: sites,
    ownSiteDomain: post.site.domain,
    ownSiteId: post.siteId,
  });
  const bad = fabricatedHrefs(await resolveToPostIds(classified));
  if (bad.size === 0) {
    return { stripped: [] };
  }
  const body = stripAnchors(post.body, bad);
  if (body !== post.body) {
    await prisma.post.update({ data: { body }, where: { id: postId } });
  }
  return { stripped: [...bad] };
};
