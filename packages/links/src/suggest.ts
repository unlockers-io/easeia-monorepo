import { type Link, LinkSource, LinkStatus, LinkType, prisma } from "@repo/db";
import { postPublicUrl } from "@repo/sites";

const INTERNAL_LIMIT = 5;
const PBN_LIMIT = 3;
const SIM_THRESHOLD = 0.78;
const ANCHOR_MAX = 80;

export type SuggestResult = {
  internal: number;
  pbn: number;
};

type Target = {
  id: string;
  link: string;
  title: string;
};

type Row = {
  categories: ReadonlyArray<string>;
  id: string;
  site_category_slug_map: unknown;
  site_default_category: string;
  site_domain: string;
  slug: string;
  title: string;
};

const query = async (refId: string, sameSite: boolean, limit: number): Promise<Array<Target>> => {
  const op = sameSite ? "=" : "<>";
  const rows = await prisma.$queryRawUnsafe<Array<Row>>(
    `
    SELECT
      p.id,
      p.categories,
      p.slug,
      p.title,
      s.domain             AS site_domain,
      s."categorySlugMap"  AS site_category_slug_map,
      s."defaultCategory"  AS site_default_category
    FROM "Post" p
    JOIN "Post" ref ON ref.id = $1 AND ref.embedding IS NOT NULL
    JOIN "Site" s ON s.id = p."siteId" AND s."isEnabled" = true
    WHERE p.id <> ref.id
      AND p.status = 'PUBLISHED'
      AND p.embedding IS NOT NULL
      AND p."siteId" ${op} ref."siteId"
      AND p.niches && ref.niches
      AND 1 - (p.embedding <=> ref.embedding) >= $2
    ORDER BY p.embedding <=> ref.embedding
    LIMIT $3
    `,
    refId,
    SIM_THRESHOLD,
    limit,
  );
  return rows.map((r) => ({
    id: r.id,
    link: postPublicUrl(
      {
        categorySlugMap: r.site_category_slug_map,
        defaultCategory: r.site_default_category,
        domain: r.site_domain,
      },
      r,
    ),
    title: r.title,
  }));
};

const truncateAnchor = (raw: string): string =>
  raw.length <= ANCHOR_MAX ? raw : `${raw.slice(0, ANCHOR_MAX - 1).trim()}…`;

const suggestionRow = (fromPostId: string, target: Target, type: LinkType, suggestedAt: Date) => ({
  anchorText: truncateAnchor(target.title),
  approved: null,
  fromPostId,
  source: LinkSource.SUGGESTED,
  status: LinkStatus.ACTIVE,
  suggestedAt,
  toPostId: target.id,
  toUrl: target.link,
  type,
});

export const suggestForPost = async (postId: string): Promise<SuggestResult> => {
  await prisma.link.deleteMany({
    where: { approved: null, fromPostId: postId, source: LinkSource.SUGGESTED },
  });

  const existing = await prisma.link.findMany({
    select: { toPostId: true },
    where: { fromPostId: postId, toPostId: { not: null } },
  });
  const existingTargets = new Set(existing.map((l) => l.toPostId));
  const fresh = (targets: ReadonlyArray<Target>, limit: number): Array<Target> =>
    targets.filter((t) => !existingTargets.has(t.id)).slice(0, limit);

  const [internal, pbn] = await Promise.allSettled([
    query(postId, true, INTERNAL_LIMIT * 2),
    query(postId, false, PBN_LIMIT * 2),
  ]);
  const internalFinal = fresh(
    internal.status === "fulfilled" ? internal.value : [],
    INTERNAL_LIMIT,
  );
  const pbnFinal = fresh(pbn.status === "fulfilled" ? pbn.value : [], PBN_LIMIT);

  const now = new Date();
  await prisma.link.createMany({
    data: [
      ...internalFinal.map((t) => suggestionRow(postId, t, LinkType.INTERNAL, now)),
      ...pbnFinal.map((t) => suggestionRow(postId, t, LinkType.PBN, now)),
    ],
  });

  return { internal: internalFinal.length, pbn: pbnFinal.length };
};

export const suggestLink = async (fromPostId: string, toPostId: string): Promise<Link> => {
  const pending = await prisma.link.findFirst({
    where: { approved: null, fromPostId, source: LinkSource.SUGGESTED, toPostId },
  });
  if (pending !== null) {
    return pending;
  }
  const [from, to] = await Promise.all([
    prisma.post.findUniqueOrThrow({ select: { siteId: true }, where: { id: fromPostId } }),
    prisma.post.findUniqueOrThrow({
      select: {
        categories: true,
        id: true,
        site: { select: { categorySlugMap: true, defaultCategory: true, domain: true } },
        siteId: true,
        slug: true,
        title: true,
      },
      where: { id: toPostId },
    }),
  ]);
  return prisma.link.create({
    data: suggestionRow(
      fromPostId,
      { id: to.id, link: postPublicUrl(to.site, to), title: to.title },
      from.siteId === to.siteId ? LinkType.INTERNAL : LinkType.PBN,
      new Date(),
    ),
  });
};
