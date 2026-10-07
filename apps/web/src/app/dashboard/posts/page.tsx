import { Niche, PostStatus, prisma } from "@repo/db";
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

const NICHE_VALUES = new Set<string>(Object.values(Niche));

const toArray = (input: string | Array<string> | undefined): Array<string> => {
  if (input === undefined || input === "") {
    return [];
  }
  return Array.isArray(input) ? input : [input];
};

const PostsPage = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.status === params.status) ?? FILTERS[0];
  const q = params.q?.trim() ?? "";
  const niches = toArray(params.niche).filter((n): n is Niche => NICHE_VALUES.has(n));
  const siteId = params.siteId?.trim() ?? "";

  const [{ data: posts }, total, sites] = await Promise.all([
    Posts.list({
      limit: 100,
      niche: niches,
      q,
      siteId,
      sort: params.sort === "oldest" ? "oldest" : "newest",
      status: filter.status,
    }),
    prisma.post.count(),
    Sites.list(),
  ]);
  const latestJobs = await findLatestJobByPost(posts.map((p) => p.id));
  const domainOf = new Map(sites.map((site) => [site.id, site.domain]));

  // Captured once per request so every relative-time string in the table
  // formats against a single reference instant.
  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();

  const rows: Array<PostRow> = posts.map((p) => {
    const job = latestJobs.get(p.id);
    return {
      activityAt: (p.publishedAt ?? p.scheduledAt ?? p.updatedAt).toISOString(),
      id: p.id,
      job: job ? { attempts: job.attempts, lastError: job.lastError, status: job.status } : null,
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
