import { postListQuerySchema } from "@repo/api-types";
import { JobKind, PostStatus, prisma } from "@repo/db";
import { findLatestJobByPost } from "@repo/jobs";
import * as Posts from "@repo/posts";
import * as Sites from "@repo/sites";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import Link from "next/link";
import { Suspense } from "react";

import { parseNiches } from "@/lib/search-params";

import PostsTable, { type PostRow } from "./posts-table";

const FILTERS = [
  { label: "All", status: undefined },
  { label: "Drafts", status: PostStatus.DRAFT },
  { label: "Scheduled", status: PostStatus.SCHEDULED },
  { label: "Published", status: PostStatus.PUBLISHED },
  { label: "Failed", status: PostStatus.FAILED },
] as const;

type SearchParams = {
  niche?: string | Array<string>;
  q?: string;
  siteId?: string;
  sort?: string;
  status?: string;
};

const PostsPage = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const params = await searchParams;
  const status = postListQuerySchema.shape.status.safeParse(params.status).data;
  const filter = FILTERS.find((f) => f.status === status) ?? FILTERS[0];
  const q = params.q?.trim() ?? "";
  const niches = parseNiches(params.niche);
  const siteId = params.siteId?.trim() ?? "";

  const [{ data: posts }, total, sites] = await Promise.all([
    Posts.list({
      limit: 100,
      niche: niches,
      q,
      siteId,
      sort: postListQuerySchema.shape.sort.safeParse(params.sort).data ?? "newest",
      status: filter.status,
    }),
    prisma.post.count(),
    Sites.list(),
  ]);

  const latestJobs = await findLatestJobByPost(
    JobKind.PUBLISH,
    posts.map((p) => p.id),
  );

  const domainOf = new Map(sites.map((site) => [site.id, site.domain]));

  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();

  const rows: Array<PostRow> = posts.map((p) => {
    const job = latestJobs.get(p.id);

    return {
      activityAt: (p.publishedAt ?? p.scheduledAt ?? p.updatedAt).toISOString(),
      id: p.id,
      job: job ? { attempts: job.attempts, lastError: job.lastError } : null,
      niches: p.niches,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      site: { domain: domainOf.get(p.siteId) ?? "", id: p.siteId },
      status: p.status,
      title: p.title,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
        <p className="text-sm text-muted-foreground">{total} posts across the network.</p>
      </header>

      <Tabs value={filter.label}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger
              key={f.label}
              render={
                <Link
                  href={f.status ? `/dashboard/posts?status=${f.status}` : "/dashboard/posts"}
                  replace
                />
              }
              value={f.label}
            >
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{filter.label} posts</h2>
          </CardTitle>
          <CardDescription>
            {posts.length} of {total} shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Suspense boundary because PostsTable reads useSearchParams();
              without it, the entire page bails out to client-side rendering. */}
          <Suspense fallback={null}>
            <PostsTable
              initialFilters={{ niches, q, siteId }}
              nowMs={nowMs}
              rows={rows}
              sites={sites.map((site) => ({ domain: site.domain, id: site.id }))}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
};

export default PostsPage;
