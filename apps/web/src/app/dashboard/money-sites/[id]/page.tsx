import { prisma } from "@repo/db";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RecrawlMoneySiteButton } from "@/components/recrawl-money-site-button";
import { moneySitePagesTag } from "@/lib/cache-tags";

const fmtRelative = (date: Date | null, nowMs: number): string => {
  if (!date) {
    return "never";
  }
  const diffMs = nowMs - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return `${diffH}h ago`;
  }
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
};

const countEmbeddedPages = (id: string) =>
  prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c
    FROM "MoneySitePage"
    WHERE "moneySiteId" = ${id}
    AND embedding IS NOT NULL
  `;

const loadMoneySite = async (id: string) => {
  "use cache";
  cacheLife("minutes");
  cacheTag(moneySitePagesTag(id));

  const [moneySite, embeddedRows] = await Promise.allSettled([
    prisma.moneySite.findUnique({
      include: {
        pages: {
          orderBy: { lastCrawledAt: "desc" },
          select: {
            id: true,
            lastCrawledAt: true,
            niches: true,
            title: true,
            url: true,
          },
        },
      },
      where: { id },
    }),
    countEmbeddedPages(id),
  ]);

  if (moneySite.status === "rejected" || !moneySite.value) {
    return null;
  }

  return {
    embeddedCount: embeddedRows.status === "fulfilled" ? Number(embeddedRows.value[0]?.c ?? 0) : 0,
    site: moneySite.value,
  };
};

/** @public Next.js app-router reads metadata via the module loader */
export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const loaded = await loadMoneySite(id);
  return { title: loaded?.site.domain ?? "Money site" };
};

const MoneySiteDetail = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const loaded = await loadMoneySite(id);

  if (!loaded) {
    notFound();
  }

  const { embeddedCount, site } = loaded;

  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();
  const total = site.pages.length;
  const classified = site.pages.filter((p) => p.niches.length > 0).length;
  const lastCrawledAt =
    site.pages.length > 0 && site.pages[0]?.lastCrawledAt ? site.pages[0].lastCrawledAt : null;

  return (
    <>
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            <span>{site.domain}</span>
            {" · "}
            <a
              className="hover:underline"
              href={site.sitemapUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              sitemap ↗
            </a>
          </div>
        </div>
        <RecrawlMoneySiteButton id={site.id} />
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3">
        {(
          [
            ["Total pages", total],
            ["Classified", classified],
            ["Embedded", embeddedCount],
            ["Last crawl", fmtRelative(lastCrawledAt, nowMs)],
          ] as const
        ).map(([label, value]) => (
          <div className="rounded border p-3 text-center" key={label}>
            <div className="text-lg font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <ul className="mt-6 space-y-2">
        {site.pages.map((page) => (
          <li className="rounded border p-3" key={page.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{page.title || "(no title)"}</div>
                <a
                  className="truncate text-xs text-muted-foreground hover:underline"
                  href={page.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {page.url} ↗
                </a>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {fmtRelative(page.lastCrawledAt, nowMs)}
              </div>
            </div>
            {page.niches.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {page.niches.map((niche) => (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium" key={niche}>
                    {niche.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
        {site.pages.length === 0 && (
          <li className="rounded border p-6 text-center text-sm text-muted-foreground">
            No pages crawled yet. Hit Re-crawl to start.
          </li>
        )}
      </ul>
    </>
  );
};

const MoneySiteDetailSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <div className="mt-4 flex items-start justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-24" />
    </div>
    <div className="grid grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((slot) => (
        <Skeleton className="h-16" key={slot} />
      ))}
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
);

const MoneySiteDetailPage = ({ params }: { params: Promise<{ id: string }> }) => (
  <section className="max-w-3xl p-6">
    <Link className="text-sm text-muted-foreground hover:underline" href="/dashboard/money-sites">
      ← Back to money sites
    </Link>

    <Suspense fallback={<MoneySiteDetailSkeleton />}>
      <MoneySiteDetail params={params} />
    </Suspense>
  </section>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default MoneySiteDetailPage;
