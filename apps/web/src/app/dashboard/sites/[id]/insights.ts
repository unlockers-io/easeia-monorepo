/**
 * Server-side helpers that fetch live and local data for a Site.
 * Returns plain JSON-friendly shapes for async server components.
 */
import { LinkType, PostStatus, prisma } from "@repo/db";
import { type OnPageCounts, summarizeOnPage } from "@repo/health";
import { liveLinkWhere } from "@repo/links";
import { postPublicUrl } from "@repo/sites";
import { cacheLife, cacheTag } from "next/cache";

import { sitePublishedPostsTag } from "@/lib/cache-tags";

import { discoverSitemap, isSameSite } from "./discover-sitemap";

export type HealthCheck = { detail?: string; name: string; ok: boolean };
type HealthReport = { checks: Array<HealthCheck>; ok: boolean };

const trimOrigin = (url: string, base: string): string => {
  try {
    if (!isSameSite(url, base)) {
      return url;
    }
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
};

export const fetchHealth = async (siteId: string): Promise<HealthReport> => {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
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
  cacheTag(sitePublishedPostsTag(siteId));

  const posts = await prisma.post.findMany({
    select: { excerpt: true, id: true, title: true },
    where: { siteId, status: PostStatus.PUBLISHED },
  });

  const inboundCount = new Map<string, number>();
  if (posts.length > 0) {
    const inbound = await prisma.link.groupBy({
      _count: { toPostId: true },
      by: ["toPostId"],
      where: {
        ...liveLinkWhere,
        fromPost: { siteId, status: PostStatus.PUBLISHED },
        toPostId: { in: posts.map((p) => p.id) },
        type: LinkType.INTERNAL,
      },
    });
    for (const row of inbound) {
      if (row.toPostId !== null) {
        inboundCount.set(row.toPostId, row._count.toPostId);
      }
    }
  }

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
  cacheTag(sitePublishedPostsTag(siteId));

  const [postsTotal, lastPost] = await Promise.all([
    prisma.post.count({ where: { siteId, status: PostStatus.PUBLISHED } }),
    prisma.post.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
      where: { siteId, status: PostStatus.PUBLISHED },
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
  cacheTag(sitePublishedPostsTag(siteId));

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
    where: { siteId, status: PostStatus.PUBLISHED },
  });
  return posts.map((p) => ({
    id: p.id,
    link: postPublicUrl(p.site, p),
    publishedAt: p.publishedAt?.toISOString() ?? null,
    slug: p.slug,
    title: p.title,
  }));
};

type LocalStats = {
  byNiche: Array<{ count: number; niche: string }>;
  publishesPerWeek: Array<{ count: number; weekStart: string }>;
};

export const fetchLocalStats = async (siteId: string): Promise<LocalStats> => {
  const posts = await prisma.post.findMany({
    select: { niches: true, publishedAt: true },
    where: { siteId },
  });

  const nicheMap = new Map<string, number>();
  for (const post of posts) {
    for (const n of post.niches) {
      nicheMap.set(n, (nicheMap.get(n) ?? 0) + 1);
    }
  }
  const byNiche = [...nicheMap.entries()]
    .map(([niche, count]) => ({ count, niche }))
    .toSorted((a, b) => b.count - a.count);

  const now = new Date();
  const weeks: Array<{ count: number; weekStart: string }> = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i * 7 - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const count = posts.filter(
      (p) => p.publishedAt !== null && p.publishedAt >= start && p.publishedAt < end,
    ).length;
    weeks.push({ count, weekStart: start.toISOString() });
  }

  return { byNiche, publishesPerWeek: weeks };
};
