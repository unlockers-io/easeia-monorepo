import * as AutoPublish from "@repo/auto-publish";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Suspense } from "react";

import { readIntegrations } from "@/lib/integrations";

import { IntegrationNotConfiguredCard } from "../lib/provider-card";

import { AutoRefresh } from "./auto-refresh";
import { BucketsHeaderActions } from "./buckets-header-actions";
import { BucketsTable, type BucketRow } from "./buckets-table";

const BucketsContent = async () => {
  // Captured once per request so every relative-time string in the table
  // formats against a single reference instant.
  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();
  const buckets = await AutoPublish.readBuckets(new Date(nowMs));

  const rows: Array<BucketRow> = buckets.map((bucket) => ({
    autoPublishEnabled: bucket.autoPublishEnabled,
    bucketTarget: bucket.bucketTarget,
    cadenceDays: bucket.cadenceDays,
    drafts: bucket.drafts.map((draft) => ({
      createdAt: draft.createdAt.toISOString(),
      id: draft.id,
      slug: draft.slug,
      title: draft.title,
    })),
    draftsCount: bucket.supply.drafts,
    inflight: bucket.supply.inflight,
    lastAutoPublishedAt: bucket.lastAutoPublishedAt?.toISOString() ?? null,
    missedCadence: bucket.missedCadence,
    needsRefill: bucket.needsRefill,
    niches: bucket.niches,
    siteDomain: bucket.domain,
    siteId: bucket.id,
    supply: bucket.supply.total,
  }));

  rows.sort((a, b) => {
    if (a.needsRefill !== b.needsRefill) {
      return a.needsRefill ? -1 : 1;
    }
    return a.supply - b.supply;
  });

  const totalDrafts = rows.reduce((sum, r) => sum + r.draftsCount, 0);
  const totalInflight = rows.reduce((sum, r) => sum + r.inflight, 0);
  const needyCount = rows.filter((r) => r.needsRefill || r.missedCadence).length;
  const missedCount = rows.filter((r) => r.missedCadence).length;

  type BuildAttentionLineResultContract = { className?: string; text: string };

  const buildAttentionLine = (): BuildAttentionLineResultContract => {
    if (missedCount > 0) {
      return {
        className: "text-destructive",
        text: `${missedCount} site${missedCount === 1 ? "" : "s"} missed a cadence slot.`,
      };
    }
    if (needyCount > 0) {
      return { text: `${needyCount} bucket${needyCount === 1 ? "" : "s"} below threshold.` };
    }
    return { text: "All buckets above their refill threshold." };
  };
  const attention = buildAttentionLine();
  const { openai } = readIntegrations();

  return (
    <>
      {!openai.configured && (
        <IntegrationNotConfiguredCard
          feature="Generate drafts for your buckets"
          missing={openai.missing}
          name="OpenAI"
        />
      )}
      <AutoRefresh inflight={totalInflight} />
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2>Network buckets</h2>
            </CardTitle>
            <CardDescription>
              {totalDrafts} draft{totalDrafts === 1 ? "" : "s"} queued
              {totalInflight > 0 ? ` · ${totalInflight} generating` : ""} across {rows.length} site
              {rows.length === 1 ? "" : "s"}.{" "}
              <span className={attention.className}>{attention.text}</span>
            </CardDescription>
          </div>
          <BucketsHeaderActions aiConfigured={openai.configured} />
        </CardHeader>
        <CardContent>
          <BucketsTable aiConfigured={openai.configured} nowMs={nowMs} rows={rows} />
        </CardContent>
      </Card>
    </>
  );
};

const BucketsSkeleton = () => (
  <Card aria-hidden>
    <CardHeader className="flex flex-row items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <CardTitle>
          <h2>Network buckets</h2>
        </CardTitle>
        <Skeleton className="h-4 w-80" />
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-64 w-full" />
    </CardContent>
  </Card>
);

const BucketsPage = () => (
  <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Buckets</h1>
      <p className="text-sm text-muted-foreground">
        Pre-generate posts in batches per site; the scheduler publishes one on cadence.
      </p>
    </header>

    <Suspense fallback={<BucketsSkeleton />}>
      <BucketsContent />
    </Suspense>
  </div>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default BucketsPage;
