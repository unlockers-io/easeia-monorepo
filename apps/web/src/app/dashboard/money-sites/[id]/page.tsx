import * as MoneySites from "@repo/money-sites";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { formatRelativeTime } from "@/lib/relative-time";

import { RecrawlMoneySiteButton } from "../recrawl-money-site-button";

const crawledLabel = (date: Date | null, nowMs: number): string =>
  date === null ? "never" : formatRelativeTime(date, nowMs);

const loadMoneySite = async (id: string) => {
  "use cache";
  cacheLife("minutes");

  return MoneySites.detail(id);
};

/** @public Next.js app-router reads metadata via the module loader */
export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const loaded = await loadMoneySite(id);

  return { title: loaded?.moneySite.domain ?? "Money site" };
};

const MoneySiteDetail = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const loaded = await loadMoneySite(id);

  if (!loaded) {
    notFound();
  }

  const { embeddedPages, lastCrawledAt, moneySite: site, pages } = loaded;

  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();
  const classified = pages.filter((p) => p.niches.length > 0).length;

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
            ["Total pages", pages.length],
            ["Classified", classified],
            ["Embedded", embeddedPages],
            ["Last crawl", crawledLabel(lastCrawledAt, nowMs)],
          ] as const
        ).map(([label, value]) => (
          <div className="rounded border p-3 text-center" key={label}>
            <div className="text-lg font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <ul className="mt-6 space-y-2">
        {pages.map((page) => (
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
                {crawledLabel(page.lastCrawledAt, nowMs)}
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
        {pages.length === 0 && (
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
