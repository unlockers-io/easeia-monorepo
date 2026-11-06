/**
 * Server-side helpers that fetch live and local data for a Site.
 * Returns plain JSON-friendly shapes for async server components.
 */
import { prisma, type Site } from "@repo/db";
import { type OnPageCounts, summarizeOnPage } from "@repo/health";
import { countInternalInboundLinks } from "@repo/links";
import { deployedWhere } from "@repo/posts";
import { postPublicUrl } from "@repo/sites";
import { cacheLife } from "next/cache";

import { discoverSitemap, isSameSite } from "./discover-sitemap";

export type HealthCheck = { detail?: string; name: string; ok: boolean };

type HealthReport = { checks: Array<HealthCheck>; ok: boolean };

const trimOrigin = (url: string, base: string): string => {
  if (!isSameSite(url, base)) {
    return url;
  }

  const parsed = new URL(url);

  return `${parsed.pathname}${parsed.search}` || "/";
};

export const fetchHealth = async (
  site: Pick<Site, "domain" | "isEnabled">,
): Promise<HealthReport> => {
  const checks: Array<HealthCheck> = [{ name: "Site enabled", ok: site.isEnabled }];

  const siteUrl = `https://${site.domain}`;

  try {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 10_000);

    try {
      const res = await fetch(siteUrl, {
        cache: "no-store",
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
      });

      checks.push({
        detail: `HTTP ${res.status}`,
        name: "Site reachable",
        ok: res.ok,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    checks.push({
      detail: error instanceof Error ? error.message : String(error),
      name: "Site reachable",
      ok: false,
    });
  }

  const sitemap = await discoverSitemap(siteUrl);
  checks.push(
    sitemap !== null && sitemap !== ""
      ? { detail: trimOrigin(sitemap, siteUrl), name: "Sitemap reachable", ok: true }
      : { name: "Sitemap reachable", ok: false },
  );

  return { checks, ok: checks.every((c) => c.ok) };
};

const issueCheck = (name: string, count: number): HealthCheck => ({
  detail: count === 0 ? "0 published posts" : `${count} published post${count === 1 ? "" : "s"}`,
  name,
  ok: count === 0,
});

export type OnPageSeoReport = HealthReport & { published: number };

const toOnPageChecks = (summary: OnPageCounts): Array<HealthCheck> => [
  issueCheck("Title too long", summary.titleTooLong),
  issueCheck("Title too short", summary.titleTooShort),
  issueCheck("Meta description too short", summary.descriptionTooShort),
  issueCheck("Meta description too long", summary.descriptionTooLong),
  issueCheck("No in-content inbound links", summary.noInboundInternal),
];

export const fetchOnPageSeo = async (siteId: string): Promise<OnPageSeoReport> => {
  "use cache";
  cacheLife("minutes");

  const posts = await prisma.post.findMany({
    select: { excerpt: true, id: true, title: true },
    where: { ...deployedWhere, siteId },
  });

  const inboundCount = await countInternalInboundLinks(posts.map((p) => p.id));

  const summary = summarizeOnPage(
    posts.map((p) => ({
      excerpt: p.excerpt,
      inboundInternal: inboundCount.get(p.id) ?? 0,
      title: p.title,
    })),
  );

  const checks = toOnPageChecks(summary);

  return { checks, ok: checks.every((c) => c.ok), published: summary.published };
};

type SiteStats = {
  lastPublishedAt: string | null;
  postsTotal: number;
};

export const fetchSiteStats = async (siteId: string): Promise<SiteStats> => {
  "use cache";
  cacheLife("minutes");

  const [postsTotal, lastPost] = await Promise.all([
    prisma.post.count({ where: { ...deployedWhere, siteId } }),
    prisma.post.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
      where: { ...deployedWhere, siteId },
    }),
  ]);

  return {
    lastPublishedAt: lastPost?.publishedAt?.toISOString() ?? null,
    postsTotal,
  };
};

export type RecentPost = {
  id: string;
  link: string;
  publishedAt: string | null;
  slug: string;
  title: string;
};

export const fetchRecentPosts = async (siteId: string, limit = 10): Promise<Array<RecentPost>> => {
  "use cache";
  cacheLife("minutes");

  const posts = await prisma.post.findMany({
    orderBy: { publishedAt: "desc" },
    select: {
      categories: true,
      id: true,
      publishedAt: true,
      site: { select: { categorySlugMap: true, defaultCategory: true, domain: true } },
      slug: true,
      title: true,
    },
    take: limit,
    where: { ...deployedWhere, siteId },
  });

  return posts.map((p) => ({
    id: p.id,
    link: postPublicUrl(p.site, p),
    publishedAt: p.publishedAt?.toISOString() ?? null,
    slug: p.slug,
    title: p.title,
  }));
};

export const fetchNicheCounts = async (
  siteId: string,
): Promise<Array<{ count: number; niche: string }>> => {
  const posts = await prisma.post.findMany({ select: { niches: true }, where: { siteId } });
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const n of post.niches) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([niche, count]) => ({ count, niche }))
    .toSorted((a, b) => b.count - a.count);
};

const WEEKS = 12;

export const fetchWeeklyPublishes = async (
  siteId: string,
): Promise<Array<{ count: number; weekStart: string }>> => {
  const now = new Date();
  const firstWeek = new Date(now);
  firstWeek.setDate(now.getDate() - (WEEKS - 1) * 7 - now.getDay());
  firstWeek.setHours(0, 0, 0, 0);

  const posts = await prisma.post.findMany({
    select: { publishedAt: true },
    where: { publishedAt: { gte: firstWeek }, siteId },
  });

  return Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(firstWeek);
    start.setDate(firstWeek.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const count = posts.filter(
      (p) => p.publishedAt !== null && p.publishedAt >= start && p.publishedAt < end,
    ).length;

    return { count, weekStart: start.toISOString() };
  });
};
