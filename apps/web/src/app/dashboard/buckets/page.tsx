import { isAiConfigured } from "@repo/ai";
import { PostStatus, prisma } from "@repo/db";
import { countBucketSupplyBySite, needsRefill, type BucketSupply } from "@repo/posts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Suspense } from "react";

import { IntegrationNotConfiguredCard } from "../lib/provider-card";

import { AutoRefresh } from "./auto-refresh";
import { BucketsHeaderActions } from "./buckets-header-actions";
import { BucketsTable, type BucketRow } from "./buckets-table";

const BucketsContent = async () => {
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: {
      autoPublishEnabled: true,
      bucketRefillAt: true,
      bucketTarget: true,
      cadenceDays: true,
      domain: true,
      id: true,
      lastAutoPublishedAt: true,
      niches: true,
      posts: {
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          id: true,
          slug: true,
          title: true,
        },
        take: 10,
        where: { scheduledAt: null, status: PostStatus.DRAFT },
      },
    },
    where: { isEnabled: true },
  });

  const siteIds = sites.map((s) => s.id);
  // Deliberately unguarded: countBucketSupplyBySite throws rather than
  // returning zeros, because a fabricated zero renders every bucket as empty,
  // marks the whole network as needing refill, and disables auto-refresh (which
  // arms only when something is in flight), so the wrong page never corrects
  // itself. An error boundary is the honest outcome.
  const supplyBySite: Map<string, BucketSupply> = await countBucketSupplyBySite(siteIds);

  // Captured once per request so every relative-time string in the table
  // formats against a single reference instant.
  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const rows: Array<BucketRow> = sites.map((s) => {
    const { drafts, inflight, supply } = supplyBySite.get(s.id) ?? {
      drafts: 0,
      inflight: 0,
      supply: 0,
    };
    const target = s.bucketTarget;
    const refillAt = s.bucketRefillAt;
    const siteNeedsRefill = needsRefill({ refillAt, supply, target });
    const cadenceDue =
      s.autoPublishEnabled &&
      s.cadenceDays !== null &&
      s.lastAutoPublishedAt !== null &&
      nowMs - s.lastAutoPublishedAt.getTime() >= s.cadenceDays * MS_PER_DAY;
    const missedCadence = cadenceDue && drafts === 0;
    return {
      autoPublishEnabled: s.autoPublishEnabled,
      bucketTarget: target,
      cadenceDays: s.cadenceDays,
      drafts: s.posts.map((p) => ({
        createdAt: p.createdAt.toISOString(),
        id: p.id,
        slug: p.slug,
        title: p.title,
      })),
      draftsCount: drafts,
      inflight,
      lastAutoPublishedAt: s.lastAutoPublishedAt?.toISOString() ?? null,
      missedCadence,
      needsRefill: siteNeedsRefill,
      niches: s.niches,
      siteDomain: s.domain,
      siteId: s.id,
      supply,
    };
  });

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

  return (
    <>
      {!isAiConfigured() && (
        <IntegrationNotConfiguredCard
          feature="Generate drafts for your buckets"
          missing={["OPENAI_API_KEY"]}
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
          <BucketsHeaderActions aiConfigured={isAiConfigured()} />
        </CardHeader>
        <CardContent>
          <BucketsTable aiConfigured={isAiConfigured()} nowMs={nowMs} rows={rows} />
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
