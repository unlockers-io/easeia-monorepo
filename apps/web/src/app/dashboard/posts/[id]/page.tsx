import { JobKind } from "@repo/db";
import { findLatestJobByPost, listJobs } from "@repo/jobs";
import { linksTo, outboundLinks } from "@repo/links";
import * as Posts from "@repo/posts";
import { hasDeployHook, isDeployable, postPath, postPublicUrl } from "@repo/sites";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableRow } from "@repo/ui/components/table";
import { TableColumns } from "@repo/ui/compositions/table-columns";
import { ExternalLink, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/action-button";
import { JobStatusBadge } from "@/components/job-status-badge";
import { readIntegrations } from "@/lib/integrations";

import { IntegrationNotConfiguredCard } from "../../lib/provider-card";
import { publishPostAction } from "../actions";
import { PostStatusBadge } from "../post-status-badge";

import { PostAuditCard, SeoNotApplicable, SerpRankCard } from "./dataforseo-cards";
import { OutboundLinksCard } from "./outbound-links";
import { PostActionsMenu } from "./post-actions-menu";
import { PostTimingLabel } from "./post-badges";
import { MoneySiteLinksPanel, RewrittenBadge } from "./rewrite-panels";
import { RewriteTriggerButton } from "./rewrite-trigger-button";
import { PostSearchConsoleCard } from "./search-console-card";
import { SimilarPostsCard } from "./similar-posts";
import { SuggestedLinksPanel } from "./suggested-links-panel";

type PostDetail = NonNullable<Awaited<ReturnType<typeof Posts.detail>>>;

const PostPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const [post, liveOutbound, { data: jobs }, latestPublish] = await Promise.all([
    Posts.detail(id),
    outboundLinks(id),
    listJobs({ limit: 5, postId: id }),
    findLatestJobByPost(JobKind.PUBLISH, [id]),
  ]);

  if (!post) {
    notFound();
  }

  const publicPageUrl = postPublicUrl(post.site, post);

  return (
    <div className="flex flex-col gap-6">
      <PostHeader job={latestPublish.get(id) ?? null} post={post} publicPageUrl={publicPageUrl} />

      <DeployHookNotice site={post.site} />
      <section className="grid gap-4 md:grid-cols-2">
        <TaxonomyCard post={post} />
        <RecentJobsCard jobs={jobs} />
      </section>

      <SeoInsights post={post} publicPageUrl={publicPageUrl} />

      <Suspense fallback={<SeoLoadingCard title="Search Console: page performance" />}>
        <PostSearchConsoleCard domain={post.site.domain} pageUrl={publicPageUrl} />
      </Suspense>

      <OutboundLinksCard outbound={liveOutbound} />

      <Suspense fallback={<SeoLoadingCard title="Similar posts" />}>
        <SimilarPostsCard postId={post.id} />
      </Suspense>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Suggested links</h2>
        <SuggestedLinksPanel postId={id} />
      </section>

      <MoneySiteLinksSection moneySite={post.site.moneySite} outbound={liveOutbound} />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Body (Markdown)</h2>
          </CardTitle>
          <CardDescription>Markdown body served to the Astro build.</CardDescription>
        </CardHeader>
        <CardContent>
          <section aria-label="Post body" className="max-h-96 overflow-auto rounded-md bg-muted">
            <pre className="p-4 font-mono text-xs">{post.body}</pre>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

const PostHeader = ({
  job,
  post,
  publicPageUrl,
}: {
  job: Parameters<typeof PostStatusBadge>[0]["job"];
  post: PostDetail;
  publicPageUrl: string;
}) => {
  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();

  return (
    <header className="flex flex-row items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <PostStatusBadge
            job={job}
            nowMs={nowMs}
            publishedAt={post.publishedAt}
            scheduledAt={post.scheduledAt}
            status={post.status}
          />
          <span className="text-sm text-muted-foreground tabular-nums">
            <PostTimingLabel nowMs={nowMs} post={post} />
          </span>
          <RewrittenBadge rewrittenAt={post.rewrittenAt} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
        <a
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
          href={publicPageUrl}
          rel="noreferrer"
          target="_blank"
        >
          {post.site.domain} · {postPath(post.site, post)}
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
      </div>
      <div className="flex items-center gap-2">
        <RewriteTriggerButton
          aiConfigured={readIntegrations().openai.configured}
          postId={post.id}
        />
        <ActionButton
          action={publishPostAction.bind(null, post.id)}
          disabled={!isDeployable(post.site)}
        >
          <Send className="size-4" />
          Publish
        </ActionButton>
        <PostActionsMenu domain={post.site.domain} postId={post.id} publicPageUrl={publicPageUrl} />
      </div>
    </header>
  );
};

const DeployHookNotice = ({ site }: { site: PostDetail["site"] }) =>
  hasDeployHook(site) ? null : (
    <output className="text-sm">
      Publishing requires a deploy hook.{" "}
      <Link className="underline" href={`/dashboard/sites/${site.id}#publishing`}>
        Configure publishing for {site.domain}
      </Link>
      .
    </output>
  );

const BadgeList = ({
  items,
  variant,
}: {
  items: ReadonlyArray<string>;
  variant: "outline" | "secondary";
}) =>
  items.length === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item} variant={variant}>
          {item}
        </Badge>
      ))}
    </div>
  );

const TaxonomyCard = ({ post }: { post: PostDetail }) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>Targeting & taxonomy</h2>
      </CardTitle>
      <CardDescription>
        Focus keyword drives SERP rank tracking. Categories/tags/niches gate content generation.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <dl className="grid grid-cols-3 gap-y-3 text-sm">
        <Term label="Focus keyword">{post.focusKeyword ?? "—"}</Term>
        <Term label="Niches">
          <BadgeList items={post.niches} variant="secondary" />
        </Term>
        <Term label="Tags">
          <BadgeList items={post.tags} variant="outline" />
        </Term>
      </dl>
    </CardContent>
  </Card>
);

const RecentJobsCard = ({ jobs }: { jobs: Awaited<ReturnType<typeof listJobs>>["data"] }) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>Recent jobs</h2>
      </CardTitle>
      <CardDescription>Last 5 jobs for this post.</CardDescription>
    </CardHeader>
    <CardContent className="px-0 pb-0">
      {jobs.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">No jobs yet.</p>
      ) : (
        <Table>
          <TableColumns
            columns={[
              { label: "Kind" },
              { label: "Status" },
              { label: "Attempts" },
              { className: "text-right", label: "When" },
            ]}
          />
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="text-xs font-medium text-muted-foreground">
                  <Link className="hover:underline" href={`/dashboard/jobs/${job.id}`}>
                    {job.kind}
                  </Link>
                </TableCell>
                <TableCell>
                  <JobStatusBadge status={job.status} />
                </TableCell>
                <TableCell className="text-sm tabular-nums">{job.attempts}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {new Date(job.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

const SeoInsights = ({ post, publicPageUrl }: { post: PostDetail; publicPageUrl: string }) => {
  const { dataforseo } = readIntegrations();

  if (!dataforseo.configured) {
    return (
      <IntegrationNotConfiguredCard
        feature="Live rankings, backlinks, and SEO audits"
        missing={dataforseo.missing}
        name="DataForSEO"
      />
    );
  }

  return (
    <>
      <div className="mt-2 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">SEO insights</h2>
        <p className="text-sm text-muted-foreground">
          Data from DataForSEO&rsquo;s metered endpoints, cached between visits.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {post.focusKeyword !== null && post.focusKeyword !== "" ? (
          <Suspense fallback={<SeoLoadingCard title="SERP rank" />}>
            <SerpRankCard
              focusKeyword={post.focusKeyword}
              siteDomain={post.site.domain}
              siteLanguage={post.site.language}
              url={publicPageUrl}
            />
          </Suspense>
        ) : (
          <SeoNotApplicable reason="Set a focus keyword to track Google ranking." />
        )}
        <Suspense fallback={<SeoLoadingCard title="Page audit" />}>
          <PostAuditCard url={publicPageUrl} />
        </Suspense>
      </section>
    </>
  );
};

const MoneySiteLinksSection = ({
  moneySite,
  outbound,
}: {
  moneySite: PostDetail["site"]["moneySite"];
  outbound: Awaited<ReturnType<typeof outboundLinks>>;
}) => {
  const moneySiteDomain = moneySite?.domain ?? null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-lg font-semibold">Money-site links</h2>
      <MoneySiteLinksPanel
        links={moneySiteDomain === null ? [] : linksTo(outbound, moneySiteDomain)}
        moneySiteDomain={moneySiteDomain}
      />
    </section>
  );
};

const SeoLoadingCard = ({ title }: { title: string }) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>{title}</h2>
      </CardTitle>
      <CardDescription>Fetching from DataForSEO…</CardDescription>
    </CardHeader>
  </Card>
);

const Term = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="col-span-2">{children}</dd>
  </>
);

export default PostPage;
