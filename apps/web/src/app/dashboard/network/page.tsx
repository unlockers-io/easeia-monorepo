import { Card, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";

import { StatGrid, type StatItem } from "@/components/stat-grid";

import { buildGraph } from "./build-graph";
import { loadNetworkGraphData } from "./data";
import { NetworkGraph, type MoneySiteOption } from "./network-graph";

const NetworkPage = async () => {
  const data = await loadNetworkGraphData();
  const { edges, nodes } = buildGraph(data);

  const moneySiteOptions: Array<MoneySiteOption> = data.moneySites
    .map((m) => ({ domain: m.domain, id: m.id, name: m.name }))
    .toSorted((a, b) => a.name.localeCompare(b.name));

  const pbnLinkTotal = data.pbnEdges.reduce((sum, e) => sum + e.count, 0);
  const moneyLinkTotal = data.moneyEdges.reduce((sum, e) => sum + e.count, 0);
  const sitesFeedingMoney = new Set(data.moneyEdges.map((e) => e.fromSiteId)).size;

  const rollupItems: ReadonlyArray<StatItem> = [
    { label: "PBN sites", value: data.pbnSites.length.toLocaleString() },
    { label: "Cross-site links", value: pbnLinkTotal.toLocaleString() },
    {
      label: "Links to money site",
      value:
        data.moneySites.length === 0
          ? "—"
          : `${moneyLinkTotal.toLocaleString()} (${sitesFeedingMoney}/${data.pbnSites.length})`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Network</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Aggregate link flow across the PBN, ending at the money site. Each PBN&nbsp;→ PBN edge is
          a cross-site link; each PBN&nbsp;→ money edge is the count of links from that site
          pointing at the target.
        </p>
      </header>

      <StatGrid columns={3} items={rollupItems} />

      {data.pbnSites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>No enabled sites</h2>
            </CardTitle>
            <CardDescription>
              Enable at least one site under Sites to see the link graph.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <NetworkGraph edges={edges} moneySites={moneySiteOptions} nodes={nodes} />
      )}
    </div>
  );
};

export default NetworkPage;
