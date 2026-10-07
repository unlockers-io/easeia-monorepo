import { LinkType, PostStatus, type Prisma, prisma } from "@repo/db";

import { liveLinkSql, liveLinkWhere } from "./live";

const pbnBacklinksWhere = {
  ...liveLinkWhere,
  toPostId: { not: null },
  type: LinkType.PBN,
} satisfies Prisma.LinkWhereInput;

const siteBacklinksWhere = (siteId: string) =>
  ({ ...pbnBacklinksWhere, toPost: { siteId } }) satisfies Prisma.LinkWhereInput;

export const countInternalInboundLinks = async (
  postIds: ReadonlyArray<string>,
): Promise<Map<string, number>> => {
  if (postIds.length === 0) {
    return new Map();
  }
  const rows = await prisma.link.groupBy({
    _count: { toPostId: true },
    by: ["toPostId"],
    where: {
      ...liveLinkWhere,
      fromPost: { status: PostStatus.PUBLISHED },
      toPostId: { in: [...postIds] },
      type: LinkType.INTERNAL,
    },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.toPostId !== null) {
      counts.set(row.toPostId, row._count.toPostId);
    }
  }
  return counts;
};

export const countPbnBacklinks = (): Promise<number> =>
  prisma.link.count({ where: pbnBacklinksWhere });

export const pbnBacklinkSummary = async (
  siteId: string,
): Promise<{ backlinks: number; referringPosts: number; referringSites: number }> => {
  const rows = await prisma.link.findMany({
    select: { fromPost: { select: { siteId: true } }, fromPostId: true },
    where: siteBacklinksWhere(siteId),
  });
  return {
    backlinks: rows.length,
    referringPosts: new Set(rows.map((r) => r.fromPostId)).size,
    referringSites: new Set(rows.map((r) => r.fromPost.siteId)).size,
  };
};

export const recentPbnBacklinks = (siteId: string, limit: number) =>
  prisma.link.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      anchorText: true,
      fromPost: {
        select: {
          id: true,
          site: { select: { domain: true, id: true } },
          title: true,
        },
      },
      id: true,
      toPost: { select: { id: true, slug: true, title: true } },
    },
    take: limit,
    where: siteBacklinksWhere(siteId),
  });

type PbnEdge = { count: number; fromSiteId: string; toSiteId: string };
type MoneyEdge = { count: number; fromSiteId: string; moneySiteId: string };

export const networkLinkEdges = async (): Promise<{
  moneyEdges: Array<MoneyEdge>;
  pbnEdges: Array<PbnEdge>;
}> => {
  const [pbnRows, moneyRows] = await Promise.all([
    prisma.$queryRaw<Array<Omit<PbnEdge, "count"> & { count: bigint }>>`
      SELECT fp."siteId" AS "fromSiteId", tp."siteId" AS "toSiteId", COUNT(*) AS count
      FROM "Link" l
      JOIN "Post" fp ON fp.id = l."fromPostId"
      JOIN "Post" tp ON tp.id = l."toPostId"
      WHERE l.type = ${LinkType.PBN}::"LinkType"
        AND fp."siteId" <> tp."siteId"
        AND ${liveLinkSql}
      GROUP BY fp."siteId", tp."siteId"
    `,
    prisma.$queryRaw<Array<Omit<MoneyEdge, "count"> & { count: bigint }>>`
      SELECT fp."siteId" AS "fromSiteId", ms.id AS "moneySiteId", COUNT(*) AS count
      FROM "Link" l
      JOIN "Post" fp ON fp.id = l."fromPostId"
      JOIN "MoneySite" ms
        ON regexp_replace(lower(ms.domain), '^www\\.', '')
         = lower(substring(l."toUrl" from '^https?://(?:www\\.)?([^/:?#]+)'))
      WHERE ${liveLinkSql}
      GROUP BY fp."siteId", ms.id
    `,
  ]);
  return {
    moneyEdges: moneyRows.map((r) => ({
      count: Number(r.count),
      fromSiteId: r.fromSiteId,
      moneySiteId: r.moneySiteId,
    })),
    pbnEdges: pbnRows.map((r) => ({
      count: Number(r.count),
      fromSiteId: r.fromSiteId,
      toSiteId: r.toSiteId,
    })),
  };
};
