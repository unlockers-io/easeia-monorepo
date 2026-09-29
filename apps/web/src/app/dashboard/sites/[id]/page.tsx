import { JobKind, JobStatus, prisma } from "@repo/db";
import { hasUsableDeployHook } from "@repo/sites";
import * as Sites from "@repo/sites";
import { Badge } from "@repo/ui/components/badge";
import { buttonVariants } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MoneySiteDropdown } from "@/components/money-site-dropdown";
import { StatGrid, type StatItem } from "@/components/stat-grid";
import { getSession } from "@/lib/auth-helpers";
import { readIntegrations } from "@/lib/integrations";

import { IntegrationNotConfiguredCard } from "../../lib/provider-card";

import { AuthorCard } from "./author-form";
import { AutoPublishForm } from "./auto-publish-form";
import {
  BacklinksCard,
  DomainRankCard,
  OnPageAuditCard,
  SeoPanel,
  TopKeywordsCard,
} from "./dataforseo-cards";
import { InboundLinksCard } from "./inbound-links";
import {
  type HealthCheck,
  fetchHealth,
  fetchOnPageSeo,
  fetchRecentPosts,
  fetchSiteStats,
} from "./insights";
import { NicheCard } from "./niche-card";
import { PublishFrequencyCard } from "./publish-frequency-card";
import { PublishingForm } from "./publishing-form";
import { SearchConsoleCard } from "./search-console-card";
import { StatGridSkeleton, CardSkeleton, SectionSkeleton } from "./skeletons";

const SitePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const [site, session, headersList, moneySiteOptions] = await Promise.all([
    Sites.find(id),
    getSession(),
    headers(),
    prisma.moneySite.findMany({
      orderBy: { domain: "asc" },
      select: { domain: true, id: true, name: true },
      where: { isEnabled: true },
    }),
  ]);
  if (!site) {
    notFound();
  }
  const host = headersList.get("host") ?? "localhost";
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
          href="/dashboard/sites"
        >
          <ArrowLeft className="size-4" />
          All sites
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              {site.isEnabled ? (
                <Badge variant="default">Enabled</Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
              {site.niches.length === 0 ? null : (
                <div className="flex flex-wrap gap-1">
                  {site.niches.map((n) => (
                    <Badge key={n} variant="secondary">
                      {n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{site.domain}</h1>
          </div>
          <div className="flex flex-row items-center gap-2">
            <label className="flex flex-col gap-1 text-sm" htmlFor={`money-site-${site.id}`}>
              <span className="text-xs font-medium text-muted-foreground">Money site</span>
              <MoneySiteDropdown
                currentMoneySiteId={site.moneySiteId}
                options={moneySiteOptions}
                siteId={site.id}
              />
            </label>
            <a
              aria-label={`Visit ${site.domain}`}
              className={cn(buttonVariants({ variant: "outline" }))}
              href={`https://${site.domain}`}
              rel="noreferrer"
              target="_blank"
            >
              Visit site
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>
      </header>

      <Suspense fallback={<StatGridSkeleton />}>
        <SiteStatGrid siteId={id} />
      </Suspense>

      <section className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<CardSkeleton title="Health checks" />}>
          <HealthChecksCard siteId={id} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Niche distribution" />}>
          <NicheCard siteId={id} />
        </Suspense>
      </section>

      <Suspense fallback={<CardSkeleton title="On-page SEO" />}>
        <OnPageSeoCard siteId={id} />
      </Suspense>

      <Suspense fallback={<CardSkeleton title="Latest posts" />}>
        <RecentWpCard siteId={id} />
      </Suspense>

      <section className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<CardSkeleton title="Publish frequency" />}>
          <PublishFrequencyCard siteId={id} />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Inbound link footprint" />}>
          <InboundLinksCard siteId={id} />
        </Suspense>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Auto-publish</h2>
          </CardTitle>
          <CardDescription>
            Have the worker generate and publish a new post on this site every N days, using the
            rewriter&apos;s voice + SEO rules. Topic hints seed the generator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutoPublishForm
            defaultBucketRefillAt={site.bucketRefillAt}
            defaultBucketTarget={site.bucketTarget}
            defaultCadenceDays={site.cadenceDays}
            defaultEnabled={site.autoPublishEnabled}
            defaultLanguage={site.language}
            defaultTopicHints={site.topicHints}
            lastAutoPublishedAt={site.lastAutoPublishedAt}
            siteId={site.id}
          />
        </CardContent>
      </Card>

      <PublishingForm
        site={{ ...site, hasDeployHook: hasUsableDeployHook(site.vercelDeployHookUrl) }}
      />
      <AuthorCard
        defaultBio={site.authorBio}
        defaultName={site.authorName}
        defaultPhotoUrl={site.authorPhotoUrl}
        defaultUrl={site.authorUrl}
        siteId={site.id}
      />

      {readIntegrations().dataforseo.configured ? (
        <>
          <div className="mt-2 flex flex-col gap-1">
            <h2 className="text-lg font-semibold">SEO insights</h2>
            <p className="text-sm text-muted-foreground">
              Live data from DataForSEO. Each section hits a metered live endpoint on render.
            </p>
          </div>

          <div className="deferred-site-panel">
            {/* Nested rather than sibling boundaries: the four DataForSEO sections stack
            vertically with unknown heights, so independent reveals shove each other down
            the panel. Nesting keeps the fetches parallel but settles the panel top-down. */}
            <SeoPanel>
              <Suspense fallback={<SectionSkeleton title="Domain rank" />}>
                <DomainRankCard domain={site.domain} />
                <Suspense fallback={<SectionSkeleton title="Backlinks" />}>
                  <BacklinksCard siteId={site.id} />
                  <Suspense fallback={<SectionSkeleton title="Homepage audit" />}>
                    <OnPageAuditCard siteId={site.id} url={`https://${site.domain}`} />
                    <Suspense fallback={<SectionSkeleton title="Top organic keywords" />}>
                      <TopKeywordsCard domain={site.domain} />
                    </Suspense>
                  </Suspense>
                </Suspense>
              </Suspense>
            </SeoPanel>
          </div>
        </>
      ) : (
        <IntegrationNotConfiguredCard
          feature="Live rankings, backlinks, and SEO audits"
          missing={readIntegrations().dataforseo.missing}
          name="DataForSEO"
        />
      )}

      {session ? (
        <Suspense fallback={<CardSkeleton title="Google Search Console" />}>
          <SearchConsoleCard domain={site.domain} origin={origin} userId={session.user.id} />
        </Suspense>
      ) : null}
    </div>
  );
};

const SiteStatGrid = async ({ siteId }: { siteId: string }) => {
  const [stats, rewriteCount] = await Promise.all([
    fetchSiteStats(siteId),
    prisma.job.count({
      where: { kind: JobKind.REWRITE_POST, post: { siteId }, status: JobStatus.DONE },
    }),
  ]);
  const items: ReadonlyArray<StatItem> = [
    { label: "Published posts", value: stats.postsTotal.toLocaleString() },
    {
      label: "Last published",
      value:
        stats.lastPublishedAt !== null && stats.lastPublishedAt !== ""
          ? new Date(stats.lastPublishedAt).toLocaleDateString()
          : "—",
    },
    { label: "Rewrites", value: rewriteCount.toLocaleString() },
  ];
  return <StatGrid columns={3} items={items} />;
};

const HealthChecksCard = async ({ siteId }: { siteId: string }) => {
  const health = await fetchHealth(siteId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Health
          {health.ok ? (
            <Badge variant="default">All good</Badge>
          ) : (
            <Badge variant="destructive">Issues</Badge>
          )}
        </CardTitle>
        <CardDescription>HTTP reachability and sitemap.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex max-h-112 flex-col gap-3 overflow-y-auto text-sm">
          {health.checks.map((c) => (
            <HealthRow check={c} key={c.name} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const OnPageSeoCard = async ({ siteId }: { siteId: string }) => {
  const report = await fetchOnPageSeo(siteId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          On-page SEO
          {report.ok ? (
            <Badge variant="default">All good</Badge>
          ) : (
            <Badge variant="destructive">Issues</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {report.published} published post{report.published === 1 ? "" : "s"}. Title 30–60
          characters, meta description 70–160, and at least one in-content inbound link. These are
          the thresholds Ahrefs Site Audit uses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex max-h-112 flex-col gap-3 overflow-y-auto text-sm">
          {report.checks.map((c) => (
            <HealthRow check={c} key={c.name} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const HealthRow = ({ check }: { check: HealthCheck }) => (
  <li className="flex items-start gap-3">
    {check.ok ? (
      <CheckCircle2 aria-hidden="true" className="size-4 h-lh shrink-0 text-primary" />
    ) : (
      <XCircle aria-hidden="true" className="size-4 h-lh shrink-0 text-destructive" />
    )}
    <div className="flex flex-col">
      <span className="font-medium">{check.name}</span>
      {check.detail !== undefined && check.detail !== "" && (
        <p className="text-sm text-muted-foreground">{check.detail}</p>
      )}
    </div>
  </li>
);

const RecentWpCard = async ({ siteId }: { siteId: string }) => {
  const posts = await fetchRecentPosts(siteId, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Latest posts</h2>
        </CardTitle>
        <CardDescription>Latest 5 published posts on this site.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {posts.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No posts on this site yet.</p>
        ) : (
          <div className="max-h-112 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/dashboard/posts/${post.id}`}
                      >
                        {post.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{post.slug}</TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {post.publishedAt !== null && post.publishedAt !== ""
                        ? formatPostDate(post.publishedAt)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        aria-label={`Open ${post.slug}`}
                        className="inline-flex items-center text-muted-foreground hover:text-foreground"
                        href={post.link}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const formatPostDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default SitePage;
