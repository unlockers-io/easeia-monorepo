import "dotenv/config";

import { prisma } from "@repo/db";
import { loadConnection, resolveSiteUrl, topPages, type TopPage } from "@repo/search-console";

// Striking distance: pages Google already shows on pages 1-3 but not in the
// top 3. A rewrite pass moves these; position > 30 usually needs links, not
// better copy, and position <= 3 is not worth the churn risk.
const MIN_POSITION = 4;
const MAX_POSITION = 30;
const MIN_IMPRESSIONS = 50;
const WINDOW_DAYS = 90;
const PAGES_PER_SITE = 100;

const stripTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const slugFromUrl = (url: string): string | null => {
  const path = stripTrailingSlash(new URL(url).pathname);
  const last = path.split("/").at(-1);
  return last === undefined || last === "" ? null : last;
};

const main = async () => {
  const appUrl = process.env.APP_URL ?? process.env.WEB_APP_URL;
  if (appUrl === undefined || appUrl === "") {
    throw new Error("APP_URL (or WEB_APP_URL) is required to build the Google OAuth redirect URI");
  }
  const connection = await prisma.googleConnection.findFirst({ select: { userId: true } });
  if (!connection || (await loadConnection(connection.userId)) === null) {
    throw new Error("No Google connection. Connect Search Console in the dashboard first.");
  }
  const ctx = {
    redirectUri: `${stripTrailingSlash(appUrl)}/api/google/callback`,
    userId: connection.userId,
  };

  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true },
    where: { isEnabled: true },
  });

  type Candidate = {
    clicks: number;
    domain: string;
    impressions: number;
    position: number;
    postId: string;
    rewrittenAt: Date | null;
    slug: string;
    title: string;
  };
  const candidates: Array<Candidate> = [];

  for (const site of sites) {
    const siteUrl = await resolveSiteUrl(ctx, site.domain);
    if (siteUrl === null) {
      console.warn(`skip ${site.domain}: not verified in Search Console`);
      continue;
    }
    const pages = await topPages(ctx, siteUrl, { days: WINDOW_DAYS, limit: PAGES_PER_SITE });
    const striking = pages.filter(
      (p) =>
        p.position >= MIN_POSITION &&
        p.position <= MAX_POSITION &&
        p.impressions >= MIN_IMPRESSIONS,
    );
    if (striking.length === 0) {
      continue;
    }

    const slugged: Array<{ page: TopPage; slug: string }> = [];
    for (const page of striking) {
      const slug = slugFromUrl(page.page);
      if (slug !== null) {
        slugged.push({ page, slug });
      }
    }
    const posts = await prisma.post.findMany({
      select: { id: true, rewrittenAt: true, slug: true, title: true },
      where: { siteId: site.id, slug: { in: slugged.map((s) => s.slug) } },
    });
    const bySlug = new Map(posts.map((p) => [p.slug, p]));
    for (const { page, slug } of slugged) {
      const post = bySlug.get(slug);
      if (!post) {
        continue;
      }
      candidates.push({
        clicks: page.clicks,
        domain: site.domain,
        impressions: page.impressions,
        position: page.position,
        postId: post.id,
        rewrittenAt: post.rewrittenAt,
        slug: post.slug,
        title: post.title,
      });
    }
  }

  candidates.sort((a, b) => b.impressions - a.impressions);

  if (candidates.length === 0) {
    console.log("No striking-distance candidates found.");
    return;
  }

  console.log(
    `\n${candidates.length} rewrite candidates (position ${MIN_POSITION}-${MAX_POSITION}, >=${MIN_IMPRESSIONS} impressions, last ${WINDOW_DAYS}d), best first:\n`,
  );
  for (const c of candidates) {
    const rewritten =
      c.rewrittenAt === null ? "" : ` [rewritten ${c.rewrittenAt.toISOString().slice(0, 10)}]`;
    console.log(
      `${c.impressions.toString().padStart(6)} impr  pos ${c.position.toFixed(1).padStart(5)}  ${c.clicks.toString().padStart(4)} clicks  ${c.domain}/${c.slug}${rewritten}`,
    );
    console.log(`        ${c.title}  (postId: ${c.postId})`);
  }
  console.log(
    "\nQueue one with: POST /api/rewrite/post/:postId (force=true to re-run an already-rewritten post).",
  );
};

try {
  await main();
  await prisma.$disconnect();
} catch (error) {
  console.error(error);
  await Promise.allSettled([prisma.$disconnect()]);
  process.exit(1);
}
