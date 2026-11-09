import { JobKind, JobStatus, prisma, type Site } from "@repo/db";
import {
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  SEO_TITLE_MIN,
} from "@repo/health";
import { countJobs } from "@repo/jobs";
import { hasDeployHook } from "@repo/sites";
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
import Link from "next/link";
import { notFound } from "next/navigation";
import { SkeletonSuspense } from "skullet/react";

import { CardSuspense } from "@/components/card-suspense";
import { StatGrid, type StatItem } from "@/components/stat-grid";
import { readIntegrations } from "@/lib/integrations";

import { IntegrationNotConfiguredCard } from "../../lib/provider-card";

import { AuthorCard } from "./author-form";
import { AutoPublishForm } from "./auto-publish-form";
import { BacklinksCard } from "./backlinks-card";
import {
  DomainRankCard,
  OnPageAuditCard,
  SectionSuspense,
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
import { MoneySiteDropdown } from "./money-site-dropdown";
import { NicheCard } from "./niche-card";
import { PublishFrequencyCard } from "./publish-frequency-card";
import { PublishingForm } from "./publishing-form";
import { SearchConsoleCard } from "./search-console-card";

const SAMPLE_SITE_STATS: ReadonlyArray<StatItem> = [
  { label: "Published posts", value: "120" },
  { label: "Last published", value: "1/1/2026" },
  { label: "Rewrites", value: "40" },
];

const SitePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const [site, moneySiteOptions] = await Promise.all([
    Sites.find(id),
    prisma.moneySite.findMany({
      orderBy: { domain: "asc" },
      select: { domain: true, id: true, name: true },
      where: { isEnabled: true },
    }),
  ]);

  if (!site) {
    notFound();
  }

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
            <div className="flex flex-col gap-1 text-sm">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor={`money-site-${site.id}`}
              >
                Money site
              </label>
              <MoneySiteDropdown
                currentMoneySiteId={site.moneySiteId}
                id={`money-site-${site.id}`}
                options={moneySiteOptions}
                siteId={site.id}
              />
            </div>
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

      <SkeletonSuspense
        id="site-stats"
        label="Loading site stats"
        skeleton={<StatGrid columns={3} items={SAMPLE_SITE_STATS} />}
      >
        <SiteStatGrid siteId={id} />
      </SkeletonSuspense>

      <section className="grid gap-4 md:grid-cols-2">
        <CardSuspense title="Health checks">
          <HealthChecksCard site={site} />
        </CardSuspense>
        <CardSuspense title="Niche distribution">
          <NicheCard siteId={id} />
        </CardSuspense>
      </section>

      <CardSuspense title="On-page SEO">
        <OnPageSeoCard siteId={id} />
      </CardSuspense>

      <CardSuspense title="Latest posts">
        <RecentPostsCard siteId={id} />
      </CardSuspense>

      <section className="grid gap-4 md:grid-cols-2">
        <CardSuspense title="Publish frequency">
          <PublishFrequencyCard siteId={id} />
        </CardSuspense>
        <CardSuspense title="Inbound link footprint">
          <InboundLinksCard siteId={id} />
        </CardSuspense>
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

      <PublishingForm site={{ ...site, hasDeployHook: hasDeployHook(site) }} />
      <CardSuspense title="Backlinks">
        <BacklinksCard siteId={site.id} />
      </CardSuspense>
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
              Data from DataForSEO&rsquo;s metered endpoints, cached between visits.
            </p>
          </div>

          <div className="deferred-site-panel">
            {/* Nested rather than sibling boundaries: the three DataForSEO sections stack
            vertically with unknown heights, so independent reveals shove each other down
            the panel. Nesting keeps the fetches parallel but settles the panel top-down. */}
            <SeoPanel>
              <SectionSuspense title="Domain rank">
                <DomainRankCard domain={site.domain} language={site.language} />
                <SectionSuspense title="Homepage audit">
                  <OnPageAuditCard siteId={site.id} url={`https://${site.domain}`} />
                  <SectionSuspense title="Top organic keywords">
                    <TopKeywordsCard domain={site.domain} language={site.language} />
                  </SectionSuspense>
                </SectionSuspense>
              </SectionSuspense>
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

      <CardSuspense title="Google Search Console">
        <SearchConsoleCard domain={site.domain} />
      </CardSuspense>
    </div>
  );
};

const SiteStatGrid = async ({ siteId }: { siteId: string }) => {
  const [stats, rewriteCount] = await Promise.all([
    fetchSiteStats(siteId),
    countJobs({ kinds: [JobKind.REWRITE_POST], siteId, status: JobStatus.DONE }),
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

const HealthChecksCard = async ({ site }: { site: Pick<Site, "domain" | "isEnabled"> }) => {
  const health = await fetchHealth(site);

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
          {report.published} published post{report.published === 1 ? "" : "s"}. Title{" "}
          {SEO_TITLE_MIN}–{SEO_TITLE_MAX} characters, meta description {SEO_DESCRIPTION_MIN}–
          {SEO_DESCRIPTION_MAX}, and at least one in-content inbound link. These are the thresholds
          Ahrefs Site Audit uses.
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

const RecentPostsCard = async ({ siteId }: { siteId: string }) => {
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
