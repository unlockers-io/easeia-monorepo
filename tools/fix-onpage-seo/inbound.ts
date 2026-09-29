import { LinkSource, LinkStatus, LinkType, PostStatus, prisma, type SiteLanguage } from "@repo/db";
import { liveLinkWhere } from "@repo/links";
import { postPublicUrl } from "@repo/sites";

const SIM_LIMIT = 8;
const MAX_NEW_PER_SOURCE = 3;
const ANCHOR_MAX = 80;

const SEE_ALSO = {
  EN: "See also",
  ES: "Véase también",
  PT: "Leia também",
} as const;

export type ListedPost = {
  categories: Array<string>;
  excerpt: string | null;
  id: string;
  siteId: string;
  slug: string;
  title: string;
};

export type LinkFix = { orphanId: string; siteId: string; sourceId: string };

const truncateAnchor = (raw: string): string =>
  raw.length <= ANCHOR_MAX ? raw : `${raw.slice(0, ANCHOR_MAX - 1).trim()}…`;

type SimilarRow = {
  body: string;
  categories: Array<string>;
  default_category: string;
  domain: string;
  id: string;
  language: SiteLanguage;
  slug: string;
  slug_map: unknown;
  title: string;
};

const similarSources = async (orphanId: string, siteId: string): Promise<Array<SimilarRow>> =>
  prisma.$queryRawUnsafe<Array<SimilarRow>>(
    `
    SELECT
      p.id,
      p.body,
      p.categories,
      p.slug,
      p.title,
      s.domain,
      s.language,
      s."categorySlugMap" AS slug_map,
      s."defaultCategory" AS default_category
    FROM "Post" p
    JOIN "Post" ref ON ref.id = $1 AND ref.embedding IS NOT NULL
    JOIN "Site" s ON s.id = p."siteId"
    WHERE p.id <> $1
      AND p.status = 'PUBLISHED'
      AND p."siteId" = $2
      AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> ref.embedding
    LIMIT $3
    `,
    orphanId,
    siteId,
    SIM_LIMIT,
  );

const fallbackSources = async (orphan: ListedPost): Promise<Array<SimilarRow>> => {
  const rows = await prisma.post.findMany({
    orderBy: { publishedAt: "desc" },
    select: {
      body: true,
      categories: true,
      id: true,
      site: {
        select: {
          categorySlugMap: true,
          defaultCategory: true,
          domain: true,
          language: true,
        },
      },
      slug: true,
      title: true,
    },
    take: SIM_LIMIT,
    where: {
      id: { not: orphan.id },
      siteId: orphan.siteId,
      status: PostStatus.PUBLISHED,
    },
  });
  const scored = [...rows].toSorted((a, b) => {
    const aShare = a.categories.some((c) => orphan.categories.includes(c)) ? 1 : 0;
    const bShare = b.categories.some((c) => orphan.categories.includes(c)) ? 1 : 0;
    return bShare - aShare;
  });
  return scored.map((p) => ({
    body: p.body,
    categories: p.categories,
    default_category: p.site.defaultCategory,
    domain: p.site.domain,
    id: p.id,
    language: p.site.language,
    slug: p.slug,
    slug_map: p.site.categorySlugMap,
    title: p.title,
  }));
};

const existingTargets = async (fromPostId: string): Promise<Set<string>> => {
  const links = await prisma.link.findMany({
    select: { toPostId: true },
    where: { ...liveLinkWhere, fromPostId, toPostId: { not: null } },
  });
  return new Set(links.flatMap((l) => (l.toPostId === null ? [] : [l.toPostId])));
};

const appendSeeAlso = (
  body: string,
  language: SiteLanguage,
  anchor: string,
  url: string,
): string => {
  const title = `## ${SEE_ALSO[language]}`;
  const bullet = `- [${anchor}](${url})`;
  if (body.includes(url)) {
    return body;
  }
  if (body.includes(title)) {
    return `${body.trimEnd()}\n${bullet}`;
  }
  return `${body.trimEnd()}\n\n${title}\n\n${bullet}`;
};

const pickSource = async (
  orphan: ListedPost,
  addedBySource: ReadonlyMap<string, number>,
): Promise<SimilarRow | undefined> => {
  const similar = await similarSources(orphan.id, orphan.siteId);
  const candidates = similar.length > 0 ? similar : await fallbackSources(orphan);
  for (const candidate of candidates) {
    if ((addedBySource.get(candidate.id) ?? 0) >= MAX_NEW_PER_SOURCE) {
      continue;
    }
    if (candidate.body.includes(orphan.slug)) {
      continue;
    }
    const targets = await existingTargets(candidate.id);
    if (targets.has(orphan.id)) {
      continue;
    }
    return candidate;
  }
  return undefined;
};

export const planInboundFixes = async (
  orphans: ReadonlyArray<ListedPost>,
): Promise<Array<LinkFix>> => {
  const addedBySource = new Map<string, number>();
  const planned: Array<LinkFix> = [];
  for (const orphan of orphans) {
    const picked = await pickSource(orphan, addedBySource);
    if (picked === undefined) {
      continue;
    }
    addedBySource.set(picked.id, (addedBySource.get(picked.id) ?? 0) + 1);
    planned.push({ orphanId: orphan.id, siteId: orphan.siteId, sourceId: picked.id });
  }
  return planned;
};

export const applyInboundFix = async (
  fix: LinkFix,
  postsById: ReadonlyMap<string, ListedPost>,
): Promise<void> => {
  const orphan = postsById.get(fix.orphanId);
  if (orphan === undefined) {
    return;
  }
  const source = await prisma.post.findUnique({
    select: {
      body: true,
      categories: true,
      site: {
        select: { categorySlugMap: true, defaultCategory: true, domain: true, language: true },
      },
      slug: true,
    },
    where: { id: fix.sourceId },
  });
  if (!source) {
    return;
  }
  const toUrl = postPublicUrl(
    {
      categorySlugMap: source.site.categorySlugMap,
      defaultCategory: source.site.defaultCategory,
      domain: source.site.domain,
    },
    orphan,
  );
  const anchor = truncateAnchor(orphan.title);
  const body = appendSeeAlso(source.body, source.site.language, anchor, toUrl);
  if (body === source.body) {
    return;
  }
  await prisma.$transaction([
    prisma.post.update({ data: { body }, where: { id: fix.sourceId } }),
    prisma.link.create({
      data: {
        anchorText: anchor,
        fromPostId: fix.sourceId,
        lastCheckedAt: new Date(),
        source: LinkSource.IMPORTED,
        status: LinkStatus.ACTIVE,
        toPostId: orphan.id,
        toUrl,
        type: LinkType.INTERNAL,
      },
    }),
  ]);
};
