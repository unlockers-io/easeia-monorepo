"use client";

import "@xyflow/react/dist/style.css";
import "./network-graph.css";

import { Badge } from "@repo/ui/components/badge";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { Globe2, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MoneySiteNode, NetworkEdge, NetworkNode, PbnSiteNode } from "./build-graph";
import { FlowCanvas, NetworkFilters } from "./flow-canvas";
import { layoutFunnel } from "./graph-layout";

type MoneySiteOption = {
  domain: string;
  id: string;
  name: string;
};

type Props = {
  edges: Array<NetworkEdge>;
  moneySites: Array<MoneySiteOption>;
  nodes: Array<NetworkNode>;
};

const PbnSiteNodeComponent = ({ data, selected }: NodeProps<PbnSiteNode>) => {
  const visibleNiches = data.niches.slice(0, 3);
  const hiddenCount = data.niches.length - visibleNiches.length;
  return (
    <div
      className={`group min-w-55 rounded-xl border bg-card px-4 py-3 text-card-foreground motion-safe:transition ${
        selected ? "ring-2 ring-primary" : ""
      } ${data.hasMoneyEdge ? "" : "border-dashed opacity-80"}`}
      data-testid={`pbn-node-${data.id}`}
    >
      <Handle className="!bg-muted-foreground" position={Position.Left} type="target" />
      <Handle className="!bg-muted-foreground" position={Position.Right} type="source" />
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs break-all">{data.domain}</span>
        <Globe2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-lg font-semibold tabular-nums">
          {data.postCount.toLocaleString()}
        </span>
        <span className="text-xs font-medium text-muted-foreground">posts</span>
      </div>
      {visibleNiches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleNiches.map((niche) => (
            <Badge key={niche} variant="secondary">
              {niche}
            </Badge>
          ))}
          {hiddenCount > 0 && <Badge variant="outline">+{hiddenCount}</Badge>}
        </div>
      )}
    </div>
  );
};

const MoneySiteNodeComponent = ({ data, selected }: NodeProps<MoneySiteNode>) => (
  <div
    className={`min-w-60 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3 text-foreground motion-safe:transition ${
      selected ? "ring-2 ring-primary" : ""
    }`}
    data-testid={`money-node-${data.id}`}
  >
    <Handle className="!bg-primary" position={Position.Left} type="target" />
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{data.name}</span>
        <span className="font-mono text-xs break-all text-muted-foreground">{data.domain}</span>
      </div>
      <Target aria-hidden="true" className="size-4 shrink-0 text-primary" />
    </div>
    <div className="mt-2 flex items-baseline gap-1">
      <span className="text-lg font-semibold tabular-nums">{data.pageCount.toLocaleString()}</span>
      <span className="text-xs font-medium text-muted-foreground">indexable pages</span>
    </div>
  </div>
);

const NODE_TYPES: NodeTypes = {
  "money-site": MoneySiteNodeComponent,
  "pbn-site": PbnSiteNodeComponent,
};

const PBN_EDGE_STROKE = "var(--muted-foreground)";
const MONEY_EDGE_STROKE = "var(--primary)";

const DIMMED = 0.07;

const edgeWidth = (count: number, max: number, ceiling: number): number => {
  if (max <= 0) {
    return 1;
  }
  const t = Math.log10(count + 1) / Math.log10(max + 1);
  return Math.max(0.75, t * ceiling);
};

const collapsePbnEdges = (edges: Array<NetworkEdge>): Array<NetworkEdge> => {
  const seen = new Map<string, NetworkEdge>();
  for (const e of edges) {
    const pairKey = [e.source, e.target].toSorted().join("|");
    const existing = seen.get(pairKey);
    if (!existing) {
      seen.set(pairKey, e);
      continue;
    }
    const count = (existing.data?.count ?? 0) + (e.data?.count ?? 0);
    const merged: NetworkEdge = {
      ...existing,
      data: { count, kind: "pbn-to-pbn" },
      label: count.toLocaleString(),
      markerStart: { color: PBN_EDGE_STROKE, type: MarkerType.ArrowClosed },
    };
    seen.set(pairKey, merged);
  }
  return [...seen.values()];
};

const NetworkGraph = ({ edges, moneySites, nodes }: Props) => {
  const { push } = useRouter();

  const [selectedMoneySiteId, setSelectedMoneySiteId] = useState(() => moneySites[0]?.id ?? "");
  const [showPbnLinks, setShowPbnLinks] = useState(false);
  const [hideOrphans, setHideOrphans] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  type NetworkGraphResultContract = {
    laidEdges: Array<NetworkEdge>;
    laidNodes: Array<NetworkNode>;
  };

  const { laidEdges, laidNodes } = ((): NetworkGraphResultContract => {
    const moneyNode = nodes.find(
      (n) => n.type === "money-site" && n.data.id === selectedMoneySiteId,
    );
    if (!moneyNode) {
      return { laidEdges: [], laidNodes: [] };
    }

    const pbnInNetwork = nodes.filter(
      (n): n is PbnSiteNode => n.type === "pbn-site" && n.data.moneySiteId === selectedMoneySiteId,
    );
    const pbnIds = new Set(pbnInNetwork.map((n) => n.id));

    const moneyEdges = edges.filter(
      (e) => e.data?.kind === "pbn-to-money" && e.target === moneyNode.id && pbnIds.has(e.source),
    );
    const sitesFeedingMoney = new Set(moneyEdges.map((e) => e.source));

    const visiblePbn = hideOrphans
      ? pbnInNetwork.filter((n) => sitesFeedingMoney.has(n.id))
      : pbnInNetwork;
    const visiblePbnIds = new Set(visiblePbn.map((n) => n.id));

    const pbnEdges = showPbnLinks
      ? collapsePbnEdges(
          edges.filter(
            (e) =>
              e.data?.kind === "pbn-to-pbn" &&
              visiblePbnIds.has(e.source) &&
              visiblePbnIds.has(e.target),
          ),
        )
      : [];

    const subEdges = [...moneyEdges.filter((e) => visiblePbnIds.has(e.source)), ...pbnEdges];

    const { edges: outEdges, nodes: outNodes } = layoutFunnel([...visiblePbn, moneyNode], subEdges);

    const maxPbn = outEdges.reduce(
      (m, e) => (e.data?.kind === "pbn-to-pbn" ? Math.max(m, e.data.count) : m),
      0,
    );
    const maxMoney = outEdges.reduce(
      (m, e) => (e.data?.kind === "pbn-to-money" ? Math.max(m, e.data.count) : m),
      0,
    );

    const focusActive = focusedNodeId !== null;
    const incident = (e: NetworkEdge): boolean =>
      e.source === focusedNodeId || e.target === focusedNodeId;
    const activeNodeIds = new Set<string>();
    if (focusActive) {
      activeNodeIds.add(focusedNodeId);
      for (const e of outEdges) {
        if (incident(e)) {
          activeNodeIds.add(e.source);
          activeNodeIds.add(e.target);
        }
      }
    }

    const styledEdges: Array<NetworkEdge> = [];
    for (const edge of outEdges) {
      const dim = focusActive && !incident(edge);
      if (edge.data?.kind === "pbn-to-money") {
        const width = edgeWidth(edge.data.count, maxMoney, 6);
        styledEdges.push({
          ...edge,
          animated: !dim,
          labelBgBorderRadius: 4,
          labelBgPadding: [4, 2],
          labelStyle: { fill: MONEY_EDGE_STROKE, fontWeight: 600 },
          markerEnd: { color: MONEY_EDGE_STROKE, type: MarkerType.ArrowClosed },
          style: {
            stroke: MONEY_EDGE_STROKE,
            strokeOpacity: dim ? DIMMED : 1,
            strokeWidth: width,
          },
          type: "smoothstep",
        });
        continue;
      }
      const width = edgeWidth(edge.data?.count ?? 1, maxPbn, 3);
      styledEdges.push({
        ...edge,
        labelBgBorderRadius: 3,
        labelBgPadding: [3, 1],
        labelBgStyle: { fill: "var(--background)", fillOpacity: 0.85 },
        labelStyle: { fill: "var(--muted-foreground)", fontSize: 10 },
        markerEnd: edge.markerEnd ?? { color: PBN_EDGE_STROKE, type: MarkerType.ArrowClosed },
        style: {
          stroke: PBN_EDGE_STROKE,
          strokeOpacity: dim ? DIMMED : 0.55,
          strokeWidth: width,
        },
        type: "default",
      });
    }

    const dimmedNodes: Array<NetworkNode> = [];
    for (const node of outNodes) {
      const faded = focusActive && !activeNodeIds.has(node.id);
      dimmedNodes.push({
        ...node,
        style: { ...node.style, opacity: faded ? DIMMED : 1 },
      });
    }

    return { laidEdges: styledEdges, laidNodes: dimmedNodes };
  })();

  const handleNodeClick: NodeMouseHandler<NetworkNode> = (event, node) => {
    if (event.metaKey || event.ctrlKey) {
      if (node.type === "pbn-site") {
        push(`/dashboard/sites/${node.data.id}`);
      } else {
        push(`/dashboard/money-sites/${node.data.id}`);
      }
      return;
    }
    setFocusedNodeId((current) => (current === node.id ? null : node.id));
  };

  const handlePaneClick = () => {
    setFocusedNodeId(null);
  };

  const canvasKey = selectedMoneySiteId;
  const filterVersion = `${String(showPbnLinks)}:${String(hideOrphans)}`;

  const handleMoneySiteChange = (id: string) => {
    setSelectedMoneySiteId(id);
    setFocusedNodeId(null);
  };

  return (
    <div
      className="flex h-network-graph min-h-105 w-full flex-col overflow-hidden rounded-xl border bg-background"
      data-testid="network-graph"
    >
      <NetworkFilters
        hideOrphans={hideOrphans}
        moneySites={moneySites}
        onHideOrphansChange={setHideOrphans}
        onMoneySiteChange={handleMoneySiteChange}
        onShowPbnLinksChange={setShowPbnLinks}
        selectedMoneySiteId={selectedMoneySiteId}
        showPbnLinks={showPbnLinks}
      />
      <div className="min-h-0 flex-1">
        <ReactFlow
          edges={laidEdges}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          key={canvasKey}
          maxZoom={1.5}
          minZoom={0.2}
          nodes={laidNodes}
          nodesConnectable={false}
          nodesDraggable
          nodeTypes={NODE_TYPES}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          proOptions={{ hideAttribution: true }}
        >
          <FlowCanvas filterVersion={filterVersion} />
        </ReactFlow>
      </div>
    </div>
  );
};

export { NetworkGraph };
export type { MoneySiteOption };
