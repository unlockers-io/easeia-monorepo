import { backlinkSummary, domainRankOverview } from "@repo/dataforseo";
import { prisma, type Prisma } from "@repo/db";
import { computeHealthScore } from "@repo/health";
import type { ConsumerContext } from "@repo/jobs";
import { loadConnection, resolveSiteUrl, totals } from "@repo/search-console";
import * as Sites from "@repo/sites";

import { env } from "../lib/env";
import { createJobLogger, log } from "../lib/logger";

type Outcome<T> = { kind: "ok"; value: T } | { error: string; kind: "err" };

const tryFetch = async <T>(label: string, fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { kind: "ok", value: await fn() };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.warn({ err: error, label, message: "snapshot fetcher failed" });
    return { error: msg, kind: "err" };
  }
};

const synthesizeDomainRank = (
  overview: {
    pos1: number;
    pos11to20: number;
    pos2to3: number;
    pos4to10: number;
  } | null,
): number | null => {
  if (!overview) {
    return null;
  }
  const weighted =
    overview.pos1 * 4 + overview.pos2to3 * 2 + overview.pos4to10 + overview.pos11to20 * 0.3;
  if (weighted <= 0) {
    return 0;
  }
  return Math.min(100, Math.round(Math.log10(weighted + 1) * 33));
};

const startOfUtcDay = (d: Date): Date => {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
};

const fetchPublishingStats = async (siteId: string) => {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * dayMs);

  const [postsLast7d, postsLast30d, mostRecent] = await Promise.all([
    prisma.post.count({ where: { publishedAt: { gte: sevenDaysAgo }, siteId } }),
    prisma.post.count({ where: { publishedAt: { gte: thirtyDaysAgo }, siteId } }),
    prisma.post.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
      where: { publishedAt: { not: null }, siteId },
    }),
  ]);

  const daysSinceLastPublish = mostRecent?.publishedAt
    ? Math.floor((now.getTime() - mostRecent.publishedAt.getTime()) / dayMs)
    : null;

  return { daysSinceLastPublish, postsLast30d, postsLast7d };
};

const checkReachability = async (siteId: string): Promise<boolean> => {
  try {
    const site = await Sites.find(siteId);
    if (!site) {
      return false;
    }
    const url = `https://${site.domain}`;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 10_000);
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
};

const fetchGsc = async (
  domain: string,
): Promise<{
  avgPosition: number | null;
  clicks: number | null;
  errorCode: "not_connected" | "no_app_url" | "not_verified" | null;
  impressions: number | null;
}> => {
  if (env.APP_URL === undefined) {
    return { avgPosition: null, clicks: null, errorCode: "no_app_url", impressions: null };
  }

  const connection = await prisma.googleConnection.findFirst({
    select: { userId: true },
  });
  if (!connection) {
    return { avgPosition: null, clicks: null, errorCode: "not_connected", impressions: null };
  }

  const ctx = {
    redirectUri: `${env.APP_URL.replace(/\/$/v, "")}/api/google/callback`,
    userId: connection.userId,
  };
  if ((await loadConnection(connection.userId)) === null) {
    return { avgPosition: null, clicks: null, errorCode: "not_connected", impressions: null };
  }

  const siteUrl = await resolveSiteUrl(ctx, domain);
  if (siteUrl === null) {
    return { avgPosition: null, clicks: null, errorCode: "not_verified", impressions: null };
  }

  const t = await totals(ctx, siteUrl, 7);
  if (t === null) {
    // Connected and verified, but the property has no rows in the window.
    // Null metrics drop the search component from the health score entirely;
    // zero-filling would score it as a first-place ranking.
    return { avgPosition: null, clicks: null, errorCode: null, impressions: null };
  }
  return {
    avgPosition: t.position,
    clicks: t.clicks,
    errorCode: null,
    impressions: t.impressions,
  };
};

const handleSnapshotSite = async (ctx: ConsumerContext<"SNAPSHOT_SITE">): Promise<void> => {
  const { siteId } = ctx.payload;
  const jobLog = createJobLogger({ jobId: ctx.jobId, queue: "snapshot-site" });
  jobLog.set({ siteId });
  const site = await Sites.find(siteId);
  if (!site) {
    jobLog.warn("snapshot: site not found, skipping");
    jobLog.emit();
    return;
  }

  const [reachable, publishing, dfsRank, dfsBacklinks, gsc] = await Promise.all([
    checkReachability(siteId),
    fetchPublishingStats(siteId),
    tryFetch("dataforseo.domainRank", () => domainRankOverview(site.domain)),
    tryFetch("dataforseo.backlinks", () => backlinkSummary(site.domain)),
    tryFetch("gsc.totals", () => fetchGsc(site.domain)),
  ]);

  const domainRank = dfsRank.kind === "ok" ? synthesizeDomainRank(dfsRank.value) : null;
  const backlinksTotal =
    dfsBacklinks.kind === "ok" ? (dfsBacklinks.value?.backlinks ?? null) : null;
  const referringDomains =
    dfsBacklinks.kind === "ok" ? (dfsBacklinks.value?.referringDomains ?? null) : null;

  const gscMetrics =
    gsc.kind === "ok" ? gsc.value : { avgPosition: null, clicks: null, impressions: null };
  const {
    avgPosition: gscAvgPosition,
    clicks: gscClicks,
    impressions: gscImpressions,
  } = gscMetrics;

  // One key per fetcher. The two DataForSEO calls previously shared a single
  // `dataforseo` key on a first-wins basis, so whenever both failed the second
  // message was dropped.
  const errors: Record<string, string> = Object.fromEntries(
    [
      ["dataforseo.domainRank", dfsRank.kind === "err" ? dfsRank.error : null],
      ["dataforseo.backlinks", dfsBacklinks.kind === "err" ? dfsBacklinks.error : null],
      ["gsc", gsc.kind === "err" ? `fetch_failed: ${gsc.error}` : (gsc.value.errorCode ?? null)],
      ["reachability", reachable ? null : "site_unreachable"],
    ].filter((entry): entry is [string, string] => entry[1] !== null),
  );

  const healthScore = computeHealthScore({
    daysSinceLastPublish: publishing.daysSinceLastPublish,
    domainRank,
    gscAvgPosition,
    gscClicks,
    postsLast30d: publishing.postsLast30d,
    reachable,
    referringDomains,
  });

  const date = startOfUtcDay(new Date());
  const errorsJson: Prisma.InputJsonValue = errors;

  await prisma.siteSnapshot.upsert({
    create: {
      backlinksTotal,
      date,
      daysSinceLastPublish: publishing.daysSinceLastPublish,
      domainRank,
      errors: errorsJson,
      gscAvgPosition,
      gscClicks,
      gscImpressions,
      healthScore,
      onPageScore: null,
      postsLast30d: publishing.postsLast30d,
      postsLast7d: publishing.postsLast7d,
      reachable,
      referringDomains,
      siteId,
    },
    update: {
      backlinksTotal,
      daysSinceLastPublish: publishing.daysSinceLastPublish,
      domainRank,
      errors: errorsJson,
      gscAvgPosition,
      gscClicks,
      gscImpressions,
      healthScore,
      postsLast30d: publishing.postsLast30d,
      postsLast7d: publishing.postsLast7d,
      reachable,
      referringDomains,
    },
    where: { siteId_date: { date, siteId } },
  });

  jobLog.set({ errors: Object.keys(errors), healthScore, reachable });
  jobLog.info("snapshot complete");
  jobLog.emit();
};

export { handleSnapshotSite };
