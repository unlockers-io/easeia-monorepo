import type { NetworkEdge, NetworkNode, PbnSiteNode } from "./build-graph";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 96;
const MONEY_HEIGHT = 110;

const ROW_GAP = 28;
const ROW_STEP = NODE_HEIGHT + ROW_GAP;
const COLUMN_GAP = 360; // x distance from PBN column to the money site
const SECOND_COLUMN_GAP = NODE_WIDTH + 96; // x offset of the wrapped column
const WRAP_THRESHOLD = 12; // connected sites before a 2nd column appears
const ORPHAN_GAP = 140; // extra x gap separating the orphan group

type LayoutResult = {
  edges: Array<NetworkEdge>;
  nodes: Array<NetworkNode>;
};

const moneyWeightBySite = (edges: Array<NetworkEdge>): Map<string, number> => {
  const weight = new Map<string, number>();
  for (const e of edges) {
    if (e.data?.kind === "pbn-to-money") {
      weight.set(e.source, (weight.get(e.source) ?? 0) + e.data.count);
    }
  }
  return weight;
};

const orderPbnSites = (
  sites: Array<PbnSiteNode>,
  weightOf: (site: PbnSiteNode) => number,
): Array<PbnSiteNode> =>
  sites.toSorted(
    (a, b) =>
      weightOf(b) - weightOf(a) ||
      b.data.postCount - a.data.postCount ||
      a.data.domain.localeCompare(b.data.domain),
  );

type StackColumnResultContract = { maxY: number; nodes: Array<PbnSiteNode> };

const stackColumn = (
  sites: Array<PbnSiteNode>,
  baseX: number,
  startY: number,
  wrap: boolean,
): StackColumnResultContract => {
  const perColumn = wrap ? Math.ceil(sites.length / 2) : sites.length;
  let maxY = startY;
  const nodes = sites.map<PbnSiteNode>((node, i) => {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    const y = startY + row * ROW_STEP;
    maxY = Math.max(maxY, y + NODE_HEIGHT);
    return {
      ...node,
      position: { x: baseX - col * SECOND_COLUMN_GAP, y },
    };
  });
  return { maxY, nodes };
};

const layoutFunnel = (nodes: Array<NetworkNode>, edges: Array<NetworkEdge>): LayoutResult => {
  const weight = moneyWeightBySite(edges);
  const moneyNode = nodes.find((n) => n.type === "money-site");

  const pbnSites = nodes.filter((n) => n.type === "pbn-site");
  const connected = pbnSites.filter((n) => (weight.get(n.id) ?? 0) > 0);
  const orphans = pbnSites.filter((n) => (weight.get(n.id) ?? 0) === 0);

  const ordered = orderPbnSites(connected, (s) => weight.get(s.id) ?? 0);
  const wrap = ordered.length > WRAP_THRESHOLD;

  const startY = 0;
  const connectedColumnX = 0;
  const connectedLaid = stackColumn(ordered, connectedColumnX, startY, wrap);

  const orphanLaid = stackColumn(
    orderPbnSites(orphans, () => 0),
    connectedColumnX - SECOND_COLUMN_GAP - ORPHAN_GAP,
    connectedLaid.maxY + ROW_STEP,
    orphans.length > WRAP_THRESHOLD,
  );

  const laidMoney: Array<NetworkNode> = moneyNode
    ? [
        {
          ...moneyNode,
          position: {
            x: connectedColumnX + NODE_WIDTH + COLUMN_GAP,
            y: (startY + connectedLaid.maxY) / 2 - MONEY_HEIGHT / 2,
          },
        },
      ]
    : [];

  return {
    edges,
    nodes: [...connectedLaid.nodes, ...orphanLaid.nodes, ...laidMoney],
  };
};

export { layoutFunnel };
