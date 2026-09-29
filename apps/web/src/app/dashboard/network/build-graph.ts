import type { Edge, Node } from "@xyflow/react";

import type { MoneyEdge, MoneySiteSummary, PbnEdge, PbnSiteSummary } from "./data";

type PbnSiteNodeData = {
  domain: string;
  hasMoneyEdge: boolean;
  id: string;
  moneySiteId: string | null;
  niches: Array<string>;
  postCount: number;
};

type MoneySiteNodeData = {
  domain: string;
  id: string;
  name: string;
  pageCount: number;
};

type PbnSiteNode = Node<PbnSiteNodeData, "pbn-site">;
type MoneySiteNode = Node<MoneySiteNodeData, "money-site">;
type NetworkNode = PbnSiteNode | MoneySiteNode;

type NetworkEdgeData = {
  count: number;
  kind: "pbn-to-pbn" | "pbn-to-money";
};
type NetworkEdge = Edge<NetworkEdgeData>;

type BuildGraphInput = {
  moneyEdges: Array<MoneyEdge>;
  moneySites: Array<MoneySiteSummary>;
  pbnEdges: Array<PbnEdge>;
  pbnSites: Array<PbnSiteSummary>;
};

type BuildGraphResult = {
  edges: Array<NetworkEdge>;
  nodes: Array<NetworkNode>;
};

const PBN_NODE_PREFIX = "pbn:";
const MONEY_NODE_PREFIX = "money:";

const pbnNodeId = (siteId: string): string => `${PBN_NODE_PREFIX}${siteId}`;
const moneyNodeId = (siteId: string): string => `${MONEY_NODE_PREFIX}${siteId}`;

const buildGraph = (input: BuildGraphInput): BuildGraphResult => {
  const moneyEdgeSources = new Set(input.moneyEdges.map((e) => e.fromSiteId));

  const pbnNodes: Array<PbnSiteNode> = input.pbnSites.map((s) => ({
    data: {
      domain: s.domain,
      hasMoneyEdge: moneyEdgeSources.has(s.id),
      id: s.id,
      moneySiteId: s.moneySiteId,
      niches: s.niches,
      postCount: s.postCount,
    },
    id: pbnNodeId(s.id),
    position: { x: 0, y: 0 },
    type: "pbn-site",
  }));

  const moneyNodes: Array<MoneySiteNode> = input.moneySites.map((m) => ({
    data: {
      domain: m.domain,
      id: m.id,
      name: m.name,
      pageCount: m.pageCount,
    },
    id: moneyNodeId(m.id),
    position: { x: 0, y: 0 },
    type: "money-site",
  }));

  const pbnEdges: Array<NetworkEdge> = input.pbnEdges.map((e) => ({
    data: { count: e.count, kind: "pbn-to-pbn" },
    id: `pbn:${e.fromSiteId}->${e.toSiteId}`,
    label: e.count.toLocaleString(),
    source: pbnNodeId(e.fromSiteId),
    target: pbnNodeId(e.toSiteId),
  }));

  const moneyEdges: Array<NetworkEdge> = input.moneyEdges.map((e) => ({
    data: { count: e.count, kind: "pbn-to-money" },
    id: `money:${e.fromSiteId}->${e.moneySiteId}`,
    label: e.count.toLocaleString(),
    source: pbnNodeId(e.fromSiteId),
    target: moneyNodeId(e.moneySiteId),
  }));

  return {
    edges: [...pbnEdges, ...moneyEdges],
    nodes: [...pbnNodes, ...moneyNodes],
  };
};

export { buildGraph, MONEY_NODE_PREFIX, PBN_NODE_PREFIX };
export type {
  BuildGraphInput,
  BuildGraphResult,
  MoneySiteNode,
  MoneySiteNodeData,
  NetworkEdge,
  NetworkEdgeData,
  NetworkNode,
  PbnSiteNode,
  PbnSiteNodeData,
};
