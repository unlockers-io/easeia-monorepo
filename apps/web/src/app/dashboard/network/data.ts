import { LinkSource, LinkType, prisma, type Niche } from "@repo/db";

type PbnSiteSummary = {
  domain: string;
  id: string;
  moneySiteId: string | null;
  niches: Array<Niche>;
  postCount: number;
};

type MoneySiteSummary = {
  domain: string;
  id: string;
  name: string;
  pageCount: number;
};

type PbnEdge = {
  count: number;
  fromSiteId: string;
  toSiteId: string;
};

// Aggregated edge: PBN site → money site. Today we resolve money-site
// targets via Site.moneySiteId (every enabled PBN already has one) and
// match by URL host (`Link.toUrl` starts with `https://<moneysite>.com`).
// We keep the type even if v1 data is empty so the UI structure is stable.
type MoneyEdge = {
  count: number;
  fromSiteId: string;
  moneySiteId: string;
};

type NetworkGraphData = {
  moneyEdges: Array<MoneyEdge>;
  moneySites: Array<MoneySiteSummary>;
  pbnEdges: Array<PbnEdge>;
  pbnSites: Array<PbnSiteSummary>;
};

type PbnEdgeRow = {
  count: bigint;
  fromSiteId: string;
  toSiteId: string;
};

type MoneyEdgeRow = {
  count: bigint;
  fromSiteId: string;
  moneySiteId: string;
};

const loadMoneyEdges = async (
  moneyDomains: Array<{ domain: string; id: string }>,
): Promise<Array<MoneyEdgeRow>> => {
  const queries = moneyDomains.map(
    ({ domain, id }) =>
      prisma.$queryRaw<Array<MoneyEdgeRow>>`
      SELECT
        fp."siteId"   AS "fromSiteId",
        ${id}::text   AS "moneySiteId",
        COUNT(*)      AS count
      FROM "Link" l
      JOIN "Post" fp ON fp.id = l."fromPostId"
      WHERE (
          l.source = ${LinkSource.IMPORTED}::"LinkSource"
          OR l.source = ${LinkSource.MANUAL}::"LinkSource"
          OR (l.source = ${LinkSource.SUGGESTED}::"LinkSource" AND l.approved = true)
        )
        AND (
          l."toUrl" ILIKE ${`http://${domain}%`}
          OR l."toUrl" ILIKE ${`http://${domain}/%`}
          OR l."toUrl" ILIKE ${`https://${domain}%`}
          OR l."toUrl" ILIKE ${`https://${domain}/%`}
          OR l."toUrl" ILIKE ${`http://www.${domain}%`}
          OR l."toUrl" ILIKE ${`https://www.${domain}%`}
        )
      GROUP BY fp."siteId"
    `,
  );

  const results = await Promise.allSettled(queries);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
};

const loadNetworkGraphData = async (): Promise<NetworkGraphData> => {
  const [sites, pbnEdgeRows] = await Promise.all([
    prisma.site.findMany({
      include: {
        _count: { select: { posts: true } },
        moneySite: {
          select: {
            _count: { select: { pages: true } },
            domain: true,
            id: true,
            name: true,
          },
        },
      },
      orderBy: { domain: "asc" },
      where: { isEnabled: true },
    }),
    prisma.$queryRaw<Array<PbnEdgeRow>>`
      SELECT
        fp."siteId" AS "fromSiteId",
        tp."siteId" AS "toSiteId",
        COUNT(*)    AS count
      FROM "Link" l
      JOIN "Post" fp ON fp.id = l."fromPostId"
      JOIN "Post" tp ON tp.id = l."toPostId"
      WHERE l.type = ${LinkType.PBN}::"LinkType"
        AND fp."siteId" <> tp."siteId"
        AND (
          l.source = ${LinkSource.IMPORTED}::"LinkSource"
          OR l.source = ${LinkSource.MANUAL}::"LinkSource"
          OR (l.source = ${LinkSource.SUGGESTED}::"LinkSource" AND l.approved = true)
        )
      GROUP BY fp."siteId", tp."siteId"
    `,
  ]);

  const moneySites = new Map<string, MoneySiteSummary>();
  for (const site of sites) {
    if (site.moneySite) {
      moneySites.set(site.moneySite.id, {
        domain: site.moneySite.domain,
        id: site.moneySite.id,
        name: site.moneySite.name,
        pageCount: site.moneySite._count.pages,
      });
    }
  }

  const moneyDomains = [...moneySites.values()].map((m) => ({
    domain: m.domain,
    id: m.id,
  }));

  const moneyEdgeRows: Array<MoneyEdgeRow> =
    moneyDomains.length === 0 ? [] : await loadMoneyEdges(moneyDomains);

  const pbnSites: Array<PbnSiteSummary> = sites.map((s) => ({
    domain: s.domain,
    id: s.id,
    moneySiteId: s.moneySiteId,
    niches: s.niches,
    postCount: s._count.posts,
  }));

  return {
    moneyEdges: moneyEdgeRows.map((r) => ({
      count: Number(r.count),
      fromSiteId: r.fromSiteId,
      moneySiteId: r.moneySiteId,
    })),
    moneySites: [...moneySites.values()],
    pbnEdges: pbnEdgeRows.map((r) => ({
      count: Number(r.count),
      fromSiteId: r.fromSiteId,
      toSiteId: r.toSiteId,
    })),
    pbnSites,
  };
};

export { loadNetworkGraphData };
export type { MoneyEdge, MoneySiteSummary, NetworkGraphData, PbnEdge, PbnSiteSummary };
