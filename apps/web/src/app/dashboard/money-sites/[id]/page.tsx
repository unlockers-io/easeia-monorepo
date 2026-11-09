import * as MoneySites from "@repo/money-sites";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SkeletonSuspense } from "skullet/react";

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

type MoneySiteDetailViewProps = {
  embeddedPages: number;
  lastCrawledAt: Date | null;
  moneySite: { domain: string; id: string; name: string; sitemapUrl: string };
  nowMs: number;
  pages: Array<{
    id: string;
    lastCrawledAt: Date | null;
    niches: Array<string>;
    title: string;
    url: string;
  }>;
};

const SAMPLE_NOW_MS = Date.UTC(2026, 0, 1);

const SAMPLE_MONEY_SITE: MoneySiteDetailViewProps = {
  embeddedPages: 120,
  lastCrawledAt: new Date(SAMPLE_NOW_MS - 3_600_000),
  moneySite: {
    domain: "acmestudios.example",
    id: "sample",
    name: "Acme Studios",
    sitemapUrl: "https://acmestudios.example/sitemap.xml",
  },
  nowMs: SAMPLE_NOW_MS,
  pages: ["a", "b", "c", "d"].map((id) => ({
    id,
    lastCrawledAt: new Date(SAMPLE_NOW_MS - 3_600_000),
    niches: ["AUDIO", "FILM"],
    title: "Recording studio rental in Lisbon",
    url: "https://acmestudios.example/spaces/recording-studio-lisbon",
  })),
};

const MoneySiteDetailView = ({
  embeddedPages,
  lastCrawledAt,
  moneySite: site,
  nowMs,
  pages,
}: MoneySiteDetailViewProps) => {
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

const MoneySiteDetail = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const loaded = await loadMoneySite(id);

  if (!loaded) {
    notFound();
  }

  // eslint-disable-next-line react-hooks-js/purity -- Server Component, not a re-rendering hook
  const nowMs = Date.now();

  return <MoneySiteDetailView {...loaded} nowMs={nowMs} />;
};

const MoneySiteDetailPage = ({ params }: { params: Promise<{ id: string }> }) => (
  <section className="max-w-3xl p-6">
    <Link className="text-sm text-muted-foreground hover:underline" href="/dashboard/money-sites">
      ← Back to money sites
    </Link>

    <SkeletonSuspense
      id="money-site-detail"
      label="Loading money site"
      skeleton={<MoneySiteDetailView {...SAMPLE_MONEY_SITE} />}
    >
      <MoneySiteDetail params={params} />
    </SkeletonSuspense>
  </section>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default MoneySiteDetailPage;
