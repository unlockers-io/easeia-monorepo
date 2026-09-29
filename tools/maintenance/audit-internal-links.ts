import "dotenv/config";

import { writeFileSync } from "node:fs";

import { prisma } from "@repo/db";

import { BROKEN_LINKS_FILE, writeBrokenLinks, type BrokenLink } from "../_shared/broken-links";

type SiteRow = { domain: string; id: string };

type PostRow = { body: string; id: string; siteId: string; slug: string; title: string };

type Hit = BrokenLink;

const MD_LINK = /\[(?<text>[^\]]+)\]\((?<href>[^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_LINK = /<a\s[^>]*href=["'](?<href>[^"']+)["'][^>]*>(?<text>[\s\S]*?)<\/a>/gi;

const normalizeDomain = (host: string): string => host.replace(/^www\./iu, "").toLowerCase();

const stripHtml = (s: string): string => s.replaceAll(/<[^>]+>/gu, "").trim();

const extractLinks = (body: string): Array<{ anchor: string; href: string }> => {
  const out: Array<{ anchor: string; href: string }> = [];
  for (const [, text, href] of body.matchAll(MD_LINK)) {
    if (text === undefined || href === undefined) {
      throw new Error("extractLinks: markdown link matched without its capture groups");
    }
    out.push({ anchor: text.trim(), href: href.trim() });
  }
  for (const [, href, text] of body.matchAll(HTML_LINK)) {
    if (href === undefined || text === undefined) {
      throw new Error("extractLinks: anchor tag matched without its capture groups");
    }
    out.push({ anchor: stripHtml(text), href: href.trim() });
  }
  return out;
};

const main = async () => {
  const sites: ReadonlyArray<SiteRow> = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true },
  });
  const networkDomains = new Set(sites.map((s) => normalizeDomain(s.domain)));
  const domainToSite = new Map(sites.map((s) => [normalizeDomain(s.domain), s] as const));

  const allPosts: ReadonlyArray<PostRow> = await prisma.post.findMany({
    orderBy: [{ siteId: "asc" }, { slug: "asc" }],
    select: { body: true, id: true, siteId: true, slug: true, title: true },
    where: { status: "PUBLISHED" },
  });

  const slugsBySite = new Map<string, Set<string>>();
  for (const p of allPosts) {
    let set = slugsBySite.get(p.siteId);
    if (!set) {
      set = new Set();
      slugsBySite.set(p.siteId, set);
    }
    set.add(p.slug);
  }

  const broken: Array<Hit> = [];
  const allInternal: Array<Hit> = [];
  let externalCount = 0;
  let totalLinks = 0;
  const postsWithBroken = new Set<string>();

  const siteById = new Map(sites.map((s) => [s.id, s] as const));

  for (const post of allPosts) {
    const fromSite = siteById.get(post.siteId);
    if (!fromSite) {
      continue;
    }

    for (const link of extractLinks(post.body)) {
      totalLinks++;

      // Resolve relative hrefs against the from-site domain so we treat
      // "/audio/foo/" and "https://audio-blog.example/audio/foo/" the same.
      let url: URL;
      try {
        url = new URL(link.href, `https://${normalizeDomain(fromSite.domain)}`);
      } catch {
        continue;
      }

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue;
      }

      const host = normalizeDomain(url.hostname);
      if (!networkDomains.has(host)) {
        externalCount++;
        continue;
      }

      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length < 2) {
        continue;
      }
      if (segments[0] === "tag" || segments[0] === "postagens" || segments[0] === "sobre-nos") {
        continue;
      }

      const targetCategory = segments.at(-2);
      const targetSlug = segments.at(-1);
      if (targetCategory === undefined || targetSlug === undefined) {
        continue;
      }
      const targetSite = domainToSite.get(host);
      if (!targetSite) {
        continue;
      }

      const hit: Hit = {
        anchorText: link.anchor,
        fromPostId: post.id,
        fromSiteDomain: fromSite.domain,
        fromSlug: post.slug,
        fromTitle: post.title,
        rawHref: link.href,
        targetCategorySlug: targetCategory,
        targetSiteDomain: targetSite.domain,
        targetSlug,
      };
      allInternal.push(hit);

      const slugs = slugsBySite.get(targetSite.id);
      if (!slugs || !slugs.has(targetSlug)) {
        broken.push(hit);
        postsWithBroken.add(post.id);
      }
    }
  }

  const summaryBySite = new Map<
    string,
    { broken: number; internal: number; postsAffected: Set<string> }
  >();
  for (const h of allInternal) {
    const cur = summaryBySite.get(h.fromSiteDomain) ?? {
      broken: 0,
      internal: 0,
      postsAffected: new Set(),
    };
    cur.internal++;
    summaryBySite.set(h.fromSiteDomain, cur);
  }
  for (const h of broken) {
    const cur = summaryBySite.get(h.fromSiteDomain) ?? {
      broken: 0,
      internal: 0,
      postsAffected: new Set(),
    };
    cur.broken++;
    cur.postsAffected.add(h.fromPostId);
    summaryBySite.set(h.fromSiteDomain, cur);
  }

  console.log(`\n=== link audit ===`);
  console.log(`posts scanned:    ${allPosts.length}`);
  console.log(`total anchors:    ${totalLinks}`);
  console.log(`external anchors: ${externalCount}`);
  console.log(`internal anchors: ${allInternal.length}`);
  console.log(`broken internal:  ${broken.length}`);
  console.log(`posts affected:   ${postsWithBroken.size}`);

  console.log(`\n=== per site ===`);
  // oxlint-disable-next-line unicorn/no-array-sort -- default-project lib predates es2023's toSorted; the spread already copies
  for (const [domain, s] of [...summaryBySite.entries()].sort(
    (a, b) => b[1].broken - a[1].broken,
  )) {
    console.log(
      `  ${domain.padEnd(30)} internal=${String(s.internal).padStart(4)}  broken=${String(s.broken).padStart(4)}  postsAffected=${s.postsAffected.size}`,
    );
  }

  writeBrokenLinks(broken);
  writeFileSync("/tmp/easeia-all-internal-links.json", JSON.stringify(allInternal, null, 2));
  console.log(`\nwrote ${BROKEN_LINKS_FILE} (${broken.length} rows)`);
  console.log(`wrote /tmp/easeia-all-internal-links.json (${allInternal.length} rows)`);

  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
