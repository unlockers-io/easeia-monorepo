"use client";

import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useRef } from "react";

type MoneySiteOption = {
  domain: string;
  id: string;
  name: string;
};

const miniMapNodeColor = (n: { type?: string }): string =>
  n.type === "money-site" ? "var(--primary)" : "var(--muted-foreground)";

type NetworkFiltersProps = {
  hideOrphans: boolean;
  moneySites: Array<MoneySiteOption>;
  onHideOrphansChange: (v: boolean) => void;
  onMoneySiteChange: (id: string) => void;
  onShowPbnLinksChange: (v: boolean) => void;
  selectedMoneySiteId: string;
  showPbnLinks: boolean;
};

export const NetworkFilters = ({
  hideOrphans,
  moneySites,
  onHideOrphansChange,
  onMoneySiteChange,
  onShowPbnLinksChange,
  selectedMoneySiteId,
  showPbnLinks,
}: NetworkFiltersProps) => (
  <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b bg-card px-3 py-3 text-xs">
    {moneySites.length > 1 && (
      <div className="flex flex-col gap-1">
        <Label htmlFor="money-site-select">
          <span className="text-xs text-muted-foreground">Money site</span>
        </Label>
        <Select
          onValueChange={(v) => {
            if (typeof v !== "string") {
              return;
            }
            onMoneySiteChange(v);
          }}
          value={selectedMoneySiteId}
        >
          <SelectTrigger className="w-50" id="money-site-select" size="default">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {moneySites.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor="toggle-pbn-links">
        <span className="text-xs">Show PBN&nbsp;↔ PBN links</span>
      </Label>
      <Switch checked={showPbnLinks} id="toggle-pbn-links" onCheckedChange={onShowPbnLinksChange} />
    </div>
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor="toggle-hide-orphans">
        <span className="text-xs">Hide orphans</span>
      </Label>
      <Switch
        checked={hideOrphans}
        id="toggle-hide-orphans"
        onCheckedChange={onHideOrphansChange}
      />
    </div>
  </div>
);

export const FlowCanvas = ({ filterVersion }: { filterVersion: string }) => {
  const { fitView } = useReactFlow();

  const prevFilterVersion = useRef(filterVersion);
  useEffect(() => {
    if (prevFilterVersion.current !== filterVersion) {
      prevFilterVersion.current = filterVersion;
      void fitView({ duration: 300, padding: 0.18 });
    }
  }, [filterVersion, fitView]);

  return (
    <>
      <Background color="var(--border)" gap={20} variant={BackgroundVariant.Dots} />
      <Controls position="bottom-left" showInteractive={false} />
      <MiniMap
        maskColor="rgba(0,0,0,0.05)"
        nodeColor={miniMapNodeColor}
        pannable
        position="bottom-right"
        zoomable
      />

      <Panel
        className="rounded-md border bg-card/90 px-3 py-2 text-xs shadow-sm backdrop-blur"
        position="top-right"
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-foreground">Legend</span>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-6 rounded bg-muted-foreground/60"
            />
            <span className="text-muted-foreground">PBN&nbsp;↔ PBN</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.75 w-6 rounded bg-primary" />
            <span className="text-muted-foreground">PBN&nbsp;→ money site</span>
          </div>
          <span className="mt-0.5 text-xs text-muted-foreground">
            Click a site to focus · ⌘/Ctrl-click to open
          </span>
        </div>
      </Panel>
    </>
  );
};
