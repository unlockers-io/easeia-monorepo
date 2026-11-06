import { prisma, type Niche } from "@repo/db";
import { type MoneyEdge, networkLinkEdges, type PbnEdge } from "@repo/links";

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

type NetworkGraphData = {
  moneyEdges: Array<MoneyEdge>;
  moneySites: Array<MoneySiteSummary>;
  pbnEdges: Array<PbnEdge>;
  pbnSites: Array<PbnSiteSummary>;
};

const loadNetworkGraphData = async (): Promise<NetworkGraphData> => {
  const [sites, edges] = await Promise.all([
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
    networkLinkEdges(),
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

  const pbnSites: Array<PbnSiteSummary> = sites.map((s) => ({
    domain: s.domain,
    id: s.id,
    moneySiteId: s.moneySiteId,
    niches: s.niches,
    postCount: s._count.posts,
  }));

  const shown = new Set(sites.map((site) => site.id));

  return {
    moneyEdges: edges.moneyEdges.filter(
      (e) => shown.has(e.fromSiteId) && moneySites.has(e.moneySiteId),
    ),
    moneySites: [...moneySites.values()],
    pbnEdges: edges.pbnEdges.filter((e) => shown.has(e.fromSiteId) && shown.has(e.toSiteId)),
    pbnSites,
  };
};

export { loadNetworkGraphData };

export type { MoneySiteSummary, NetworkGraphData, PbnSiteSummary };
