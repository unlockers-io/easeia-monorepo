"use client";

import type { Niche } from "@repo/db";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, ChevronRight, Loader2, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { publishNextFromBucketAction, refillBucketAction } from "./actions";
import { DraftRow, type Draft } from "./draft-row";

export type BucketRow = {
  autoPublishEnabled: boolean;
  bucketTarget: number | null;
  cadenceDays: number | null;
  drafts: Array<Draft>;
  draftsCount: number;
  inflight: number;
  lastAutoPublishedAt: string | null;
  missedCadence: boolean;
  needsRefill: boolean;
  niches: ReadonlyArray<Niche>;
  siteDomain: string;
  siteId: string;
  supply: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const relativeTime = (iso: string | null, nowMs: number): string => {
  if (iso === null) {
    return "never";
  }
  const diff = nowMs - new Date(iso).getTime();
  if (diff < 0) {
    return new Date(iso).toLocaleString("en-US", { timeZone: "UTC" });
  }
  const days = Math.floor(diff / MS_PER_DAY);
  if (days >= 1) {
    return `${days}d ago`;
  }
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours >= 1) {
    return `${hours}h ago`;
  }
  const minutes = Math.floor(diff / (60 * 1000));
  return `${Math.max(1, minutes)}m ago`;
};

const nextPublishLabel = (
  lastAutoPublishedAt: string | null,
  cadenceDays: number | null,
  enabled: boolean,
): string => {
  if (!enabled || cadenceDays === null) {
    return "paused";
  }
  if (lastAutoPublishedAt === null) {
    return "within 1h";
  }
  const next = new Date(lastAutoPublishedAt).getTime() + cadenceDays * MS_PER_DAY;
  const diff = next - Date.now();
  if (diff <= 0) {
    return "within 1h";
  }
  const days = Math.floor(diff / MS_PER_DAY);
  if (days >= 1) {
    return `in ${days}d`;
  }
  return `in ${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))}h`;
};

const fillRatio = (supply: number, target: number | null): number => {
  if (target === null || target === 0) {
    return 0;
  }
  return Math.min(1, supply / target);
};

// isLow comes from the row's already-derived `needsRefill` rather than being
// re-derived from refillAt: the local rule omitted the config-validity check,
// so a site with refillAt > target rendered a red bar next to a missing badge
// and an enabled Refill button that could only ever queue zero.
const BucketBar = ({
  isLow,
  supply,
  target,
}: {
  isLow: boolean;
  supply: number;
  target: number | null;
}) => {
  const ratio = fillRatio(supply, target);
  return (
    <div className="flex w-32 flex-col gap-1">
      <div className="text-xs font-medium tabular-nums">
        {supply}
        {target === null ? "" : ` / ${target}`}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("bucket-column-width", `h-full ${isLow ? "bg-destructive" : "bg-primary"}`)}
          style={{ "--buckets-table-width": `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
};

const RowActions = ({
  aiConfigured,
  bucketTarget,
  draftsCount,
  siteId,
}: {
  aiConfigured: boolean;
  bucketTarget: number | null;
  draftsCount: number;
  siteId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleRefill = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await refillBucketAction(siteId);
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        setMessage(
          result.queued > 0
            ? `+${result.queued} draft${result.queued === 1 ? "" : "s"} queued`
            : "Already at target",
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Refill failed");
      }
    });
  };

  const handlePublishNext = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await publishNextFromBucketAction(siteId);
        setMessage(result.ok ? "Publishing queued" : result.error);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Publish failed");
      }
    });
  };

  const refillDisabled = pending || !aiConfigured || bucketTarget === null;
  const refillTitle =
    bucketTarget === null ? "Set a bucket target on the site detail page" : "Refill to target";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button
          disabled={refillDisabled}
          onClick={handleRefill}
          size="sm"
          title={refillTitle}
          type="button"
          variant="outline"
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="size-3.5 motion-safe:animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="size-3.5" />
          )}
          Refill
        </Button>
        <Button
          disabled={pending || draftsCount === 0}
          onClick={handlePublishNext}
          size="sm"
          title={draftsCount === 0 ? "Bucket is empty" : "Publish the oldest draft now"}
          type="button"
          variant="outline"
        >
          <Send aria-hidden="true" className="size-3.5" />
          Publish next
        </Button>
      </div>
      {message === null ? null : (
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
};

const RowBadges = ({ row }: { row: BucketRow }) => (
  <div className="flex flex-wrap gap-1">
    {row.niches.slice(0, 3).map((n) => (
      <Badge key={n} variant="secondary">
        {n.toLowerCase()}
      </Badge>
    ))}
    {row.inflight > 0 ? <Badge variant="outline">{row.inflight} generating</Badge> : null}
    {row.missedCadence ? <Badge variant="destructive">missed cadence</Badge> : null}
    {row.needsRefill && !row.missedCadence ? (
      <Badge variant="destructive">needs refill</Badge>
    ) : null}
    {row.autoPublishEnabled ? null : <Badge variant="outline">paused</Badge>}
  </div>
);

const ExpandedDrafts = ({ nowMs, row }: { nowMs: number; row: BucketRow }) => {
  if (row.drafts.length === 0) {
    const hint =
      row.inflight > 0
        ? ` ${row.inflight} draft${row.inflight === 1 ? "" : "s"} currently being generated.`
        : " Click Refill to queue some drafts.";
    return (
      <div className="mr-2 mb-2 ml-9">
        <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
          Bucket is empty.{hint}
        </p>
      </div>
    );
  }
  return (
    <div className="mr-2 mb-2 ml-9">
      <ul className="flex flex-col gap-1">
        {row.drafts.map((draft) => (
          <DraftRow draft={draft} key={draft.id} nowMs={nowMs} />
        ))}
        {row.draftsCount > row.drafts.length ? (
          <p className="px-3 text-xs text-muted-foreground">
            + {row.draftsCount - row.drafts.length} more in the bucket.{" "}
            <Link
              className="hover:underline"
              href={`/dashboard/posts?siteId=${row.siteId}&status=DRAFT&sort=oldest`}
            >
              View all
            </Link>
          </p>
        ) : null}
      </ul>
    </div>
  );
};

type ExpandedState = ReadonlySet<string>;

const toggleExpanded = (current: ExpandedState, siteId: string): ExpandedState => {
  const next = new Set(current);
  if (next.has(siteId)) {
    next.delete(siteId);
  } else {
    next.add(siteId);
  }
  return next;
};

const ROW_GRID = "grid grid-cols-buckets items-center gap-3";

export const BucketsTable = ({
  aiConfigured,
  nowMs,
  rows,
}: {
  aiConfigured: boolean;
  nowMs: number;
  rows: ReadonlyArray<BucketRow>;
}) => {
  const [expanded, setExpanded] = useState<ExpandedState>(new Set());

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No enabled sites. Add a site from the Sites page to start filling buckets.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`${ROW_GRID} border-b border-border px-2 py-2 text-xs tracking-wide text-muted-foreground uppercase`}
      >
        <span aria-hidden="true" />
        <span>Site</span>
        <span>Bucket</span>
        <span>Cadence</span>
        <span>Last → next</span>
        <span className="text-right">Actions</span>
      </div>

      {rows.map((row) => {
        const isOpen = expanded.has(row.siteId);
        const cadenceLabel = row.cadenceDays === null ? "—" : `every ${row.cadenceDays}d`;
        return (
          <div className="flex flex-col deferred-bucket-row" key={row.siteId}>
            <div className={`${ROW_GRID} rounded-md px-2 py-3 hover:bg-muted/40`}>
              <button
                aria-expanded={isOpen}
                aria-label={`Drafts for ${row.siteDomain}`}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setExpanded((s) => toggleExpanded(s, row.siteId));
                }}
                type="button"
              >
                {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>

              <div className="flex min-w-0 flex-col">
                <Link
                  className="truncate text-sm font-medium hover:underline"
                  href={`/dashboard/sites/${row.siteId}`}
                >
                  {row.siteDomain}
                </Link>
                <RowBadges row={row} />
              </div>

              <BucketBar isLow={row.needsRefill} supply={row.supply} target={row.bucketTarget} />

              <span className="text-sm text-muted-foreground">{cadenceLabel}</span>

              <span className="text-sm text-muted-foreground">
                {relativeTime(row.lastAutoPublishedAt, nowMs)} →{" "}
                {nextPublishLabel(row.lastAutoPublishedAt, row.cadenceDays, row.autoPublishEnabled)}
              </span>

              <div className="flex justify-end">
                <RowActions
                  aiConfigured={aiConfigured}
                  bucketTarget={row.bucketTarget}
                  draftsCount={row.draftsCount}
                  siteId={row.siteId}
                />
              </div>
            </div>

            {isOpen ? <ExpandedDrafts nowMs={nowMs} row={row} /> : null}
          </div>
        );
      })}
    </div>
  );
};
