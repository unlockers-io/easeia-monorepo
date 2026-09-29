import { Niche, PostStatus, prisma, type Prisma } from "@repo/db";
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
  const sortDirection: "asc" | "desc" = params.sort === "oldest" ? "asc" : "desc";

  const where: Prisma.PostWhereInput = {};
  if (filter.status) {
    where.status = filter.status;
  }
  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }
  if (niches.length > 0) {
    where.niches = { hasSome: niches };
  }
  if (siteId) {
    where.siteId = siteId;
  }

  const [posts, totalsByStatus, sites] = await Promise.all([
    prisma.post.findMany({
      include: {
        jobs: {
          orderBy: { createdAt: "desc" },
          select: { attempts: true, lastError: true, status: true },
          take: 1,
        },
        site: { select: { domain: true, id: true } },
      },
      orderBy: { createdAt: sortDirection },
      take: 100,
      where,
    }),
    prisma.post.groupBy({ _count: true, by: ["status"] }),
    prisma.site.findMany({
      orderBy: { domain: "asc" },
      select: { domain: true, id: true },
    }),
  ]);

  const total = totalsByStatus.reduce((sum, g) => sum + g._count, 0);
  // Captured once per request so every relative-time string in the table
  // formats against a single reference instant.
  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();

  const rows: Array<PostRow> = posts.map((p) => ({
    activityAt: (p.publishedAt ?? p.scheduledAt ?? p.updatedAt).toISOString(),
    id: p.id,
    job: p.jobs[0] ?? null,
    niches: p.niches,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    site: { domain: p.site.domain, id: p.site.id },
    status: p.status,
    title: p.title,
  }));

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
              sites={sites}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
};

export default PostsPage;
