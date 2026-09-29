import {
  JobKind,
  JobStatus,
  LinkType,
  prisma,
  type MoneySite,
  type Site,
  type SiteSnapshot,
} from "@repo/db";
import { buildRecommendations } from "@repo/health";
import { liveLinkWhere } from "@repo/links";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SectionHead } from "@/components/section-head";
import { StatGrid, type StatItem } from "@/components/stat-grid";
import { getSession } from "@/lib/auth-helpers";

import { refreshSnapshotsAction } from "./actions";
import { ScheduleTable } from "./schedule-table";
import { AttentionRow } from "./site-card";
import type { SiteCardModel } from "./site-card-model";

type MoneySiteSummary = Pick<MoneySite, "id" | "name" | "domain">;
type SiteWithSnapshots = Site & {
  moneySite: MoneySiteSummary | null;
  snapshots: Array<SiteSnapshot>;
};

const avgTone = (avg: number | null): StatItem["tone"] => {
  if (avg === null) {
    return "muted";
  }
  return avg < 60 ? "destructive" : "default";
};

const needsAttention = (c: SiteCardModel): boolean =>
  c.latest !== null && (!c.latest.reachable || (c.latest.healthScore ?? 100) < 60);

const DashboardContent = async () => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [sites, recentJobs, moneySiteCount, rewriteCount, pbnBacklinksTotal] = await Promise.all([
    prisma.site.findMany({
      include: {
        moneySite: { select: { domain: true, id: true, name: true } },
        snapshots: { orderBy: { date: "desc" }, take: 14 },
      },
      orderBy: { domain: "asc" },
      where: { isEnabled: true },
    }),
    prisma.job.findMany({
      include: { post: { select: { slug: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.moneySite.count({
      where: { pbnSites: { some: {} } },
    }),
    prisma.job.count({
      where: { kind: JobKind.REWRITE_POST, status: JobStatus.DONE },
    }),
    prisma.link.count({
      where: {
        ...liveLinkWhere,
        toPostId: { not: null },
        type: LinkType.PBN,
      },
    }),
  ]);

  const cards = sites.map((site) => buildSiteCardModel(site));
  cards.sort(scoreAscFirst);
  const flagged = cards.filter(needsAttention);

  const lastSnapshotAt = cards
    .reduce<Array<Date>>((acc, c) => {
      if (c.latest?.createdAt) {
        acc.push(c.latest.createdAt);
      }
      return acc;
    }, [])
    .toSorted((a, b) => b.getTime() - a.getTime())
    .at(0);

  const rollup = buildNetworkRollup(cards, pbnBacklinksTotal);

  const rollupItems: ReadonlyArray<StatItem> = [
    {
      description: `Across ${rollup.totalSites} enabled ${rollup.totalSites === 1 ? "site" : "sites"}`,
      emphasis: "lead",
      label: "Average health",
      suffix: rollup.avgScore === null ? undefined : "/100",
      tone: avgTone(rollup.avgScore),
      value: rollup.avgScore === null ? "n/a" : String(rollup.avgScore),
    },
    {
      description: "Unreachable or health under 60",
      emphasis: "lead",
      label: "Need attention",
      suffix: `/${rollup.totalSites}`,
      tone: rollup.needsAttention === 0 ? "default" : "destructive",
      value: String(rollup.needsAttention),
    },
    { emphasis: "minor", label: "Posts, 7 days", value: rollup.postsLast7d.toLocaleString() },
    { emphasis: "minor", label: "Backlinks", value: rollup.backlinksTotal.toLocaleString() },
    { emphasis: "minor", label: "Money sites", value: moneySiteCount.toLocaleString() },
    { emphasis: "minor", label: "Rewrites", value: rewriteCount.toLocaleString() },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <header className="flex flex-col gap-4 border-b-4 border-foreground pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl leading-display-tight font-black tracking-display-tight">
              Network report
            </h1>
            <p className="mt-2 text-(length:--text-label) text-muted-foreground">
              {lastSnapshotAt === undefined
                ? "No snapshots yet"
                : `Snapshots ${lastSnapshotAt.toLocaleString()}`}
              {` · ${rollup.totalSites} ${rollup.totalSites === 1 ? "site" : "sites"} · ${moneySiteCount} money ${moneySiteCount === 1 ? "site" : "sites"}`}
            </p>
          </div>
          <form action={refreshSnapshotsAction}>
            <Button type="submit" variant="outline">
              <RefreshCw className="size-4" />
              Refresh all
            </Button>
          </form>
        </header>

        <StatGrid columns={6} items={rollupItems} rule={false} />
      </div>

      <section>
        <SectionHead
          aside={`${flagged.length} of ${cards.length} · worst first`}
          no="01"
          title="Sites needing attention"
        />
        <AttentionList flagged={flagged} total={cards.length} />
      </section>

      <section>
        <SectionHead
          aside={
            <>
              All {cards.length} · <Link href="/dashboard/sites">Manage sites</Link>
            </>
          }
          no="02"
          title="Schedule of sites"
        />
        {cards.length === 0 ? null : <ScheduleTable cards={cards} />}
      </section>

      <section>
        <SectionHead
          aside={<Link href="/dashboard/jobs">All jobs</Link>}
          no="03"
          title="Recent activity"
        />
        {recentJobs.length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <Table>
            <TableCaption className="sr-only">
              Latest publish, rewrite, and snapshot runs
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-0">Time</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Post</TableHead>
                <TableHead className="pr-0 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="pl-0 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>{humanizeKind(job.kind)}</TableCell>
                  <TableCell className="max-w-(--container-measure-body) truncate whitespace-normal">
                    {job.post ? (
                      <Link
                        className="hover:underline hover:underline-offset-4"
                        href={`/dashboard/posts/${job.postId}`}
                      >
                        {job.post.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-0 text-right">
                    <JobStatusMark status={job.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <footer className="flex flex-wrap justify-between gap-3 border-t-4 border-foreground pt-2.5 text-xs text-muted-foreground">
        <span>Easeia · Network report</span>
        <span>
          {lastSnapshotAt === undefined
            ? "Awaiting first snapshot"
            : `Figures as of ${lastSnapshotAt.toLocaleDateString()}`}
        </span>
      </footer>
    </div>
  );
};

const AttentionList = ({
  flagged,
  total,
}: {
  flagged: ReadonlyArray<SiteCardModel>;
  total: number;
}) => {
  if (total === 0) {
    return (
      <p className="py-5 text-sm text-muted-foreground">
        No enabled sites. Add one from{" "}
        <Link
          className="font-bold text-foreground underline underline-offset-4"
          href="/dashboard/sites"
        >
          Sites
        </Link>
        .
      </p>
    );
  }
  if (flagged.length === 0) {
    return (
      <p className="py-5 text-sm text-muted-foreground">
        All {total} sites are in good standing. Nothing needs you today.
      </p>
    );
  }
  return flagged.map((card) => <AttentionRow card={card} key={card.site.id} />);
};

const humanizeKind = (kind: JobKind): string =>
  kind
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

const buildSiteCardModel = (site: SiteWithSnapshots): SiteCardModel => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const latest = site.snapshots.at(0) ?? null;
  const prior = site.snapshots.find((s) => s.date < sevenDaysAgo) ?? null;

  const recommendations =
    latest === null ? [] : buildRecommendations({ latest, prior, siteId: site.id });

  return { latest, moneySite: site.moneySite, prior, recommendations, site };
};

const scoreAscFirst = (a: SiteCardModel, b: SiteCardModel): number => {
  const aReach = a.latest?.reachable ?? true;
  const bReach = b.latest?.reachable ?? true;
  if (aReach !== bReach) {
    return aReach ? 1 : -1;
  }
  const aScore = a.latest?.healthScore ?? null;
  const bScore = b.latest?.healthScore ?? null;
  if (aScore === null && bScore === null) {
    return a.site.domain.localeCompare(b.site.domain);
  }
  if (aScore === null) {
    return -1;
  }
  if (bScore === null) {
    return 1;
  }
  return aScore - bScore;
};

type NetworkRollup = {
  avgScore: number | null;
  backlinksTotal: number;
  needsAttention: number;
  postsLast7d: number;
  totalSites: number;
};

const buildNetworkRollup = (cards: Array<SiteCardModel>, backlinksTotal: number): NetworkRollup => {
  const totalSites = cards.length;
  const scored = cards.reduce<Array<number>>((acc, c) => {
    if (typeof c.latest?.healthScore === "number") {
      acc.push(c.latest.healthScore);
    }
    return acc;
  }, []);
  const avgScore =
    scored.length === 0 ? null : Math.round(scored.reduce((sum, s) => sum + s, 0) / scored.length);
  const postsLast7d = cards.reduce((sum, c) => sum + (c.latest?.postsLast7d ?? 0), 0);
  return {
    avgScore,
    backlinksTotal,
    needsAttention: cards.filter(needsAttention).length,
    postsLast7d,
    totalSites,
  };
};

type StatusMark = { className: string; label: string };

const jobStatusMark = (status: JobStatus): StatusMark => {
  if (status === JobStatus.DONE) {
    return { className: "text-success", label: "Done" };
  }
  if (status === JobStatus.FAILED) {
    return { className: "text-destructive", label: "Failed" };
  }
  if (status === JobStatus.RUNNING) {
    return { className: "text-warning motion-safe:animate-pulse", label: "Running" };
  }
  return { className: "text-muted-foreground", label: "Queued" };
};

const JobStatusMark = ({ status }: { status: JobStatus }) => {
  const mark = jobStatusMark(status);
  return (
    <span className={`text-xs font-extrabold tracking-wide uppercase ${mark.className}`}>
      {mark.label}
    </span>
  );
};

const DashboardSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-10">
    <header className="flex flex-row items-end justify-between gap-4 border-b-4 border-foreground pb-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-8 w-28" />
    </header>
    <div className="grid grid-cols-2 gap-4 border-t-4 border-foreground py-4 md:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton className="h-20" key={i} />
      ))}
    </div>
    <Skeleton className="h-56" />
    <Skeleton className="h-72" />
  </div>
);

const Dashboard = () => (
  <Suspense fallback={<DashboardSkeleton />}>
    <DashboardContent />
  </Suspense>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default Dashboard;
