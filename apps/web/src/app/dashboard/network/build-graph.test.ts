import { describe, expect, it } from "vitest";

import {
  buildGraph,
  MONEY_NODE_PREFIX,
  PBN_NODE_PREFIX,
  type BuildGraphInput,
} from "./build-graph";

const sampleInput: BuildGraphInput = {
  moneyEdges: [{ count: 5, fromSiteId: "s1", moneySiteId: "m1" }],
  moneySites: [{ domain: "money.com", id: "m1", name: "Money", pageCount: 30 }],
  pbnEdges: [
    { count: 7, fromSiteId: "s1", toSiteId: "s2" },
    { count: 3, fromSiteId: "s2", toSiteId: "s1" },
  ],
  pbnSites: [
    { domain: "a.com", id: "s1", moneySiteId: "m1", niches: ["FILM"], postCount: 100 },
    { domain: "b.com", id: "s2", moneySiteId: "m1", niches: ["AUDIO"], postCount: 50 },
    { domain: "c.com", id: "s3", moneySiteId: null, niches: [], postCount: 12 },
  ],
};

describe("buildGraph", () => {
  it("emits one node per PBN site plus one per money site", () => {
    const { nodes } = buildGraph(sampleInput);
    expect(nodes).toHaveLength(sampleInput.pbnSites.length + sampleInput.moneySites.length);
  });

  it("namespaces node ids by kind so PBN and money ids can't collide", () => {
    const { nodes } = buildGraph(sampleInput);
    for (const node of nodes) {
      if (node.type === "pbn-site") {
        expect(node.id.startsWith(PBN_NODE_PREFIX)).toBe(true);
      } else {
        expect(node.id.startsWith(MONEY_NODE_PREFIX)).toBe(true);
      }
    }
  });

  it("emits exactly one edge per input aggregate", () => {
    const { edges } = buildGraph(sampleInput);
    expect(edges).toHaveLength(sampleInput.pbnEdges.length + sampleInput.moneyEdges.length);
  });

  it("marks at least one edge as flowing into the money site", () => {
    const { edges } = buildGraph(sampleInput);
    const moneyBound = edges.filter((e) => e.data?.kind === "pbn-to-money");
    expect(moneyBound.length).toBeGreaterThan(0);
    for (const edge of moneyBound) {
      expect(edge.target.startsWith(MONEY_NODE_PREFIX)).toBe(true);
    }
  });

  it("preserves the raw link count as the edge label and data.count", () => {
    const { edges } = buildGraph(sampleInput);
    const s1ToS2 = edges.find((e) => e.id === "pbn:s1->s2");
    expect(s1ToS2?.label).toBe("7");
    expect(s1ToS2?.data?.count).toBe(7);
  });

  it("flags PBN sites that contribute to the money site so the UI can highlight them", () => {
    const { nodes } = buildGraph(sampleInput);
    const s1 = nodes.find((n) => n.id === `${PBN_NODE_PREFIX}s1`);
    const s3 = nodes.find((n) => n.id === `${PBN_NODE_PREFIX}s3`);
    if (s1?.type !== "pbn-site" || s3?.type !== "pbn-site") {
      throw new Error("expected pbn-site nodes");
    }
    expect(s1.data.hasMoneyEdge).toBe(true);
    expect(s3.data.hasMoneyEdge).toBe(false);
  });

  it("returns empty edges when no inputs are given but still emits nodes", () => {
    const { edges, nodes } = buildGraph({
      moneyEdges: [],
      moneySites: [{ domain: "m.com", id: "m1", name: "M", pageCount: 0 }],
      pbnEdges: [],
      pbnSites: [{ domain: "a.com", id: "s1", moneySiteId: null, niches: [], postCount: 0 }],
    });
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(0);
  });
});
