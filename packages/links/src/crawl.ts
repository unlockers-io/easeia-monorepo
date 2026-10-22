import { LinkSource, LinkStatus, LinkType, prisma } from "@repo/db";

import { editPostBody } from "./body";
import { classifyLinks, type ClassifiedLink, type ResolvedLink } from "./classify";
import { extractLinks } from "./extract";
import { liveLinkWhere } from "./live";
import { fabricatedHrefs, stripAnchors } from "./prune";

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

const resolveBodyLinks = async (post: {
  body: string;
  domain: string;
  siteId: string;
}): Promise<Array<ResolvedLink>> => {
  const network = await prisma.site.findMany({ select: { domain: true, id: true } });

  return resolveToPostIds(
    classifyLinks({
      base: `https://${post.domain}`,
      links: extractLinks(post.body),
      network,
      ownSiteDomain: post.domain,
      ownSiteId: post.siteId,
    }),
  );
};

export const crawlPost = async (postId: string): Promise<CrawlSummary | null> => {
  const post = await prisma.post.findUnique({
    include: { site: { select: { domain: true } } },
    where: { id: postId },
  });

  if (post === null || post.body === "") {
    return null;
  }

  const resolved = await resolveBodyLinks({ ...post, domain: post.site.domain });

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

  const crawledTargets = new Set(rows.flatMap((r) => (r.toPostId === null ? [] : [r.toPostId])));

  const recorded = await prisma.link.findMany({
    select: { id: true, toPostId: true, toUrl: true },
    where: { ...liveLinkWhere, fromPostId: post.id, source: { not: LinkSource.IMPORTED } },
  });

  const superseded = recorded.filter(
    (link) =>
      !post.body.includes(link.toUrl) ||
      (link.toPostId !== null && crawledTargets.has(link.toPostId)),
  );

  await prisma.$transaction([
    prisma.link.deleteMany({ where: { fromPostId: post.id, source: LinkSource.IMPORTED } }),
    prisma.link.deleteMany({ where: { id: { in: superseded.map((link) => link.id) } } }),
    prisma.link.createMany({ data: rows }),
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
  const stripped = await editPostBody(postId, async (post) => {
    if (post.body === "") {
      return { body: post.body, result: [] };
    }

    const bad = fabricatedHrefs(await resolveBodyLinks(post));

    return { body: stripAnchors(post.body, bad), result: [...bad] };
  });

  return { stripped: stripped ?? [] };
};
