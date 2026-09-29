import { LinkSource, LinkStatus, LinkType, type Niche, prisma } from "@repo/db";
import { postPublicUrl } from "@repo/sites";

const INTERNAL_LIMIT = 5;
const PBN_LIMIT = 3;
const SIM_THRESHOLD = 0.78;
const ANCHOR_MAX = 80;

export type SuggestOptions = {
  smartAnchors?: boolean;
};

export type SuggestResult = {
  internal: number;
  pbn: number;
};

export type Candidate = {
  id: string;
  link: string;
  niches: ReadonlyArray<Niche>;
  similarity: number;
  siteId: string;
  siteIsEnabled: boolean;
  slug: string;
  title: string;
};

export const filterCandidates = (input: {
  candidates: ReadonlyArray<Candidate>;
  existingLinkTargets: ReadonlySet<string>;
}): Array<Candidate> =>
  input.candidates.filter((c) => c.siteIsEnabled && !input.existingLinkTargets.has(c.id));

type Row = {
  categories: ReadonlyArray<string>;
  id: string;
  niches: ReadonlyArray<Niche>;
  similarity: number;
  site_category_slug_map: unknown;
  site_default_category: string;
  site_domain: string;
  site_id: string;
  site_is_enabled: boolean;
  slug: string;
  title: string;
};

const query = async (
  refId: string,
  sameSite: boolean,
  limit: number,
): Promise<Array<Candidate>> => {
  const op = sameSite ? "=" : "<>";
  const rows = await prisma.$queryRawUnsafe<Array<Row>>(
    `
    SELECT
      p.id,
      p."siteId"    AS site_id,
      s."isEnabled" AS site_is_enabled,
      p.niches,
      p.categories,
      p.slug,
      p.title,
      s.domain             AS site_domain,
      s."categorySlugMap"  AS site_category_slug_map,
      s."defaultCategory"  AS site_default_category,
      1 - (p.embedding <=> ref.embedding) AS similarity
    FROM "Post" p
    JOIN "Post" ref ON ref.id = $1 AND ref.embedding IS NOT NULL
    JOIN "Site" s ON s.id = p."siteId" AND s."isEnabled" = true
    WHERE p.id <> ref.id
      AND p.status = 'PUBLISHED'
      AND p.embedding IS NOT NULL
      AND p."siteId" ${op} ref."siteId"
      AND p.niches && ref.niches
      AND 1 - (p.embedding <=> ref.embedding) >= $2
    ORDER BY similarity DESC
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
    niches: r.niches,
    similarity: r.similarity,
    siteId: r.site_id,
    siteIsEnabled: r.site_is_enabled,
    slug: r.slug,
    title: r.title,
  }));
};

const truncateAnchor = (raw: string): string =>
  raw.length <= ANCHOR_MAX ? raw : `${raw.slice(0, ANCHOR_MAX - 1).trim()}…`;

export const suggestForPost = async (
  postId: string,
  _opts: SuggestOptions = {},
): Promise<SuggestResult> => {
  await prisma.link.deleteMany({
    where: { approved: null, fromPostId: postId, source: LinkSource.SUGGESTED },
  });

  const existing = await prisma.link.findMany({
    select: { toPostId: true },
    where: { fromPostId: postId, toPostId: { not: null } },
  });
  const existingTargets = new Set(existing.map((l) => l.toPostId).filter((id) => id !== null));

  const [internal, pbn] = await Promise.allSettled([
    query(postId, true, INTERNAL_LIMIT * 2),
    query(postId, false, PBN_LIMIT * 2),
  ]);

  const internalRows = internal.status === "fulfilled" ? internal.value : [];
  const pbnRows = pbn.status === "fulfilled" ? pbn.value : [];

  const internalFinal = filterCandidates({
    candidates: internalRows,
    existingLinkTargets: existingTargets,
  }).slice(0, INTERNAL_LIMIT);
  const pbnFinal = filterCandidates({
    candidates: pbnRows,
    existingLinkTargets: existingTargets,
  }).slice(0, PBN_LIMIT);

  const now = new Date();
  const rows = [
    ...internalFinal.map((c) => ({
      anchorText: truncateAnchor(c.title),
      approved: null,
      fromPostId: postId,
      source: LinkSource.SUGGESTED,
      status: LinkStatus.ACTIVE,
      suggestedAt: now,
      toPostId: c.id,
      toUrl: c.link,
      type: LinkType.INTERNAL,
    })),
    ...pbnFinal.map((c) => ({
      anchorText: truncateAnchor(c.title),
      approved: null,
      fromPostId: postId,
      source: LinkSource.SUGGESTED,
      status: LinkStatus.ACTIVE,
      suggestedAt: now,
      toPostId: c.id,
      toUrl: c.link,
      type: LinkType.PBN,
    })),
  ];

  if (rows.length > 0) {
    await prisma.link.createMany({ data: rows });
  }

  return { internal: internalFinal.length, pbn: pbnFinal.length };
};
