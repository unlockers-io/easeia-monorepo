import { isLiveLink } from "@repo/links";
import * as Posts from "@repo/posts";
import { hasUsableDeployHook, postPath, postPublicUrl } from "@repo/sites";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Table, TableBody, TableCell, TableRow } from "@repo/ui/components/table";
import { TableColumns } from "@repo/ui/compositions/table-columns";
import { ExternalLink, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RewriteTriggerButton } from "@/components/rewrite-trigger-button";
import { SuggestedLinksPanel } from "@/components/suggested-links-panel";
import { getSession } from "@/lib/auth-helpers";
import { readIntegrations } from "@/lib/integrations";

import { deletePostAction, publishPostAction } from "../../actions";
import { IntegrationNotConfiguredCard } from "../../lib/provider-card";
import { PostStatusBadge } from "../post-status-badge";

import { PostAuditCard, SeoNotApplicable, SerpRankCard } from "./dataforseo-cards";
import { OutboundLinksCard } from "./outbound-links";
import { JobStatusBadge, PostTimingLabel } from "./post-badges";
import { MoneySiteLinksPanel, RewrittenBadge } from "./rewrite-panels";
import { PostSearchConsoleCard } from "./search-console-card";
import { SimilarPostsCard } from "./similar-posts";

const PostPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const [post, session, headersList] = await Promise.all([
    Posts.detail(id),
    getSession(),
    headers(),
  ]);
  if (!post) {
    notFound();
  }

  const moneySiteDomain = post.site.moneySite?.domain ?? null;

  // predicates. The money-site panel used to filter on `approved: true`, but the
  // crawler writes IMPORTED rows with `approved` NULL, so it hid every link
  // actually present in the published HTML and showed only the subset the
  // rewriter had flipped. `isLiveLink` is the same rule the dashboard and
  // network graph use.
  const liveOutbound = post.outbound.filter(isLiveLink);
  const moneySiteLinks =
    moneySiteDomain !== null && moneySiteDomain !== ""
      ? liveOutbound.filter((l) => l.toUrl.includes(moneySiteDomain))
      : [];

  // Captured once so every relative-time string on the page formats against a
  // single reference instant.
  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();
  const publicPageUrl = postPublicUrl(post.site, post);
  const permalinkLabel = `${post.site.domain} · ${postPath(post.site, post)}`;
  const host = headersList.get("host") ?? "localhost";
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <PostStatusBadge
              job={post.jobs[0] ?? null}
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
            {permalinkLabel}
            <ExternalLink className="size-3.5 shrink-0" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <RewriteTriggerButton aiConfigured={readIntegrations().openai.configured} postId={id} />
          <form action={publishPostAction}>
            <input name="id" type="hidden" value={post.id} />
            <Button
              disabled={!post.site.isEnabled || !hasUsableDeployHook(post.site.vercelDeployHookUrl)}
              type="submit"
            >
              <Send className="size-4" />
              Publish
            </Button>
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button aria-label="Post actions" size="icon" variant="outline">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-max max-w-(--available-width)">
              <DropdownMenuItem
                render={
                  // eslint-disable-next-line jsx-a11y/control-has-associated-label, react-doctor/control-has-associated-label -- base-ui forwards the menu item children into the rendered anchor
                  <a href={publicPageUrl} rel="noreferrer" target="_blank" />
                }
              >
                <ExternalLink className="size-4" />
                View on {post.site.domain}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={deletePostAction}>
                <input name="id" type="hidden" value={post.id} />
                <DropdownMenuItem
                  render={
                    // eslint-disable-next-line jsx-a11y/control-has-associated-label -- base-ui forwards the menu item children into the rendered button
                    <button className="w-full" type="submit" />
                  }
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete post
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!hasUsableDeployHook(post.site.vercelDeployHookUrl) && (
        <output className="text-sm">
          Publishing requires a deploy hook.{" "}
          <Link className="underline" href={`/dashboard/sites/${post.site.id}#publishing`}>
            Configure publishing for {post.site.domain}
          </Link>
          .
        </output>
      )}
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Targeting & taxonomy</h2>
            </CardTitle>
            <CardDescription>
              Focus keyword drives SERP rank tracking. Categories/tags/niches gate content
              generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              <Term label="Focus keyword">{post.focusKeyword ?? "—"}</Term>
              <Term label="Niches">
                {post.niches.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {post.niches.map((n) => (
                      <Badge key={n} variant="secondary">
                        {n}
                      </Badge>
                    ))}
                  </div>
                )}
              </Term>
              <Term label="Tags">
                {post.tags.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {post.tags.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </Term>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Recent jobs</h2>
            </CardTitle>
            <CardDescription>Last 5 publish attempts for this post.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {post.jobs.length === 0 ? (
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
                  {post.jobs.map((job) => (
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
      </section>

      {readIntegrations().dataforseo.configured ? (
        <>
          <div className="mt-2 flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">SEO insights</h2>
            <p className="text-sm text-muted-foreground">
              Live data from DataForSEO. Each card hits a metered live endpoint on render.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-2">
            {post.focusKeyword !== null && post.focusKeyword !== "" ? (
              <Suspense fallback={<SeoLoadingCard title="SERP rank" />}>
                <SerpRankCard
                  focusKeyword={post.focusKeyword}
                  siteDomain={post.site.domain}
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
      ) : (
        <IntegrationNotConfiguredCard
          feature="Live rankings, backlinks, and SEO audits"
          missing={readIntegrations().dataforseo.missing}
          name="DataForSEO"
        />
      )}

      {session ? (
        <Suspense fallback={<SeoLoadingCard title="Search Console: page performance" />}>
          <PostSearchConsoleCard
            domain={post.site.domain}
            origin={origin}
            pageUrl={publicPageUrl}
            userId={session.user.id}
          />
        </Suspense>
      ) : null}

      <OutboundLinksCard outbound={liveOutbound} />

      <Suspense fallback={<SeoLoadingCard title="Similar posts" />}>
        <SimilarPostsCard postId={post.id} />
      </Suspense>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Suggested links</h2>
        <SuggestedLinksPanel postId={id} />
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-lg font-semibold">Money-site links</h2>
        <MoneySiteLinksPanel links={moneySiteLinks} moneySiteDomain={moneySiteDomain} />
      </section>

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
