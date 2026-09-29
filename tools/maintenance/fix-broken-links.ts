import "dotenv/config";

import { prisma } from "@repo/db";

import { recordAffectedSites } from "../_shared/affected-sites";
import { readBrokenLinks } from "../_shared/broken-links";

const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 12;

const stripWww = (h: string): string => h.replace(/^www\./u, "");

const parseLocs = (xml: string): Array<string> =>
  [...xml.matchAll(/<loc>(?<loc>[^<]+)<\/loc>/gu)].map((m) => (m.groups?.loc ?? "").trim());

const fetchText = async (url: string): Promise<{ status: number; text: string }> => {
  try {
    const r = await fetch(url, { redirect: "follow" });
    return { status: r.status, text: r.ok ? await r.text() : "" };
  } catch {
    return { status: 0, text: "" };
  }
};

const segments = (path: string): Array<string> => path.split("/").filter(Boolean);
const lastSeg = (path: string): string => {
  const segs = segments(path);
  return segs.at(-1) ?? "";
};
const firstSeg = (path: string): string => {
  const segs = segments(path);
  return segs.at(0) ?? "";
};

const escapeRegex = (s: string): string => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const postPathFromLoc = (loc: string): { path: string; slug: string } | null => {
  try {
    const p = new URL(loc).pathname;
    const segs = segments(p);
    const slug = segs[1];
    if (segs.length !== 2 || segs[0] === "tag" || slug === undefined || slug === "") {
      return null;
    }
    return { path: p.endsWith("/") ? p : `${p}/`, slug };
  } catch {
    return null;
  }
};

const buildSlugToPath = async (domain: string): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const idx = await fetchText(`https://${domain}/sitemap-index.xml`);
  if (idx.status !== 200) {
    return map;
  }
  for (const child of parseLocs(idx.text)) {
    const c = await fetchText(child);
    for (const loc of parseLocs(c.text)) {
      const post = postPathFromLoc(loc);
      if (post) {
        map.set(post.slug, post.path);
      }
    }
  }
  return map;
};

const editHref = (
  body: string,
  href: string,
  newHref: string | null,
): { body: string; n: number } => {
  const h = escapeRegex(href);
  let n = 0;
  const mdRe = new RegExp(`\\[([^\\]]+)\\]\\(${h}(?:\\s+"[^"]*")?\\)`, "gv");
  let out = body.replace(mdRe, (_f: string, anchor: string) => {
    n++;
    return newHref === null ? anchor : `[${anchor}](${newHref})`;
  });
  const htmlRe = new RegExp(`<a\\s[^>]*href=["']${h}["'][^>]*>([\\s\\S]*?)</a>`, "giv");
  out = out.replace(htmlRe, (full: string, inner: string) => {
    n++;
    if (newHref === null) {
      return inner;
    }
    return full.replace(new RegExp(`(href=["'])${h}(["'])`, "iv"), `$1${newHref}$2`);
  });
  return { body: out, n };
};

const main = async () => {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  const broken = readBrokenLinks();
  const brokenUrls = new Set(broken.map((b) => b.rawHref));

  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { categorySlugMap: true, defaultCategory: true, domain: true, id: true },
  });
  const domainToSite = new Map(sites.map((s) => [s.domain, s]));
  const slugToPath = new Map<string, Map<string, string>>(); // domain -> slug -> "/cat/slug/"
  for (const site of sites) {
    const map = await buildSlugToPath(site.domain);
    slugToPath.set(site.domain, map);
    console.log(`sitemap ${site.domain}: ${map.size} URLs`);
  }

  const pubPosts = await prisma.post.findMany({
    select: { categories: true, siteId: true, slug: true },
    where: { status: "PUBLISHED" },
  });
  const catMapBySite = new Map<string, Map<string, Map<string, number>>>(); // siteId -> cat -> liveSlug -> votes
  for (const p of pubPosts) {
    const site = sites.find((s) => s.id === p.siteId);
    const cat = p.categories.at(0);
    if (!site || cat === undefined || cat === "") {
      continue;
    }
    const path = slugToPath.get(site.domain)?.get(p.slug);
    if (path === undefined || path === "") {
      continue;
    }
    const liveCat = firstSeg(path);
    const byCat = catMapBySite.get(p.siteId) ?? new Map<string, Map<string, number>>();
    const votes = byCat.get(cat) ?? new Map<string, number>();
    votes.set(liveCat, (votes.get(liveCat) ?? 0) + 1);
    byCat.set(cat, votes);
    catMapBySite.set(p.siteId, byCat);
  }
  const finalCatMap = new Map<string, Record<string, string>>(); // siteId -> {cat: slug}
  for (const [siteId, byCat] of catMapBySite) {
    const out: Record<string, string> = {};
    for (const [cat, votes] of byCat) {
      // oxlint-disable-next-line unicorn/no-array-sort -- default-project lib predates es2023's toSorted; the spread already copies
      const best = [...votes.entries()].sort((a, b) => b[1] - a[1]).at(0);
      if (best) {
        out[cat] = best[0];
      }
    }
    finalCatMap.set(siteId, out);
  }

  const rows = await prisma.link.findMany({
    select: {
      anchorText: true,
      fromPost: {
        select: { body: true, id: true, site: { select: { domain: true } }, slug: true },
      },
      id: true,
      toUrl: true,
      type: true,
    },
    where: { toUrl: { in: [...brokenUrls] } },
  });

  const staleLinkIds: Array<string> = [];
  type Action = { href: string; linkId: string; newHref: string | null; toPostId?: string };
  const perPost = new Map<string, { actions: Array<Action>; domain: string }>();
  const rewriteSamples: Array<string> = [];
  const stripSamples: Array<string> = [];

  for (const r of rows) {
    const inBody = r.fromPost.body.includes(r.toUrl);
    if (!inBody) {
      staleLinkIds.push(r.id);
      continue;
    }
    let targetDomain: string;
    let slug: string;
    try {
      const u = new URL(r.toUrl);
      targetDomain = stripWww(u.host);
      slug = lastSeg(u.pathname);
    } catch {
      targetDomain = ""; // relative href
      slug = lastSeg(r.toUrl);
    }
    const targetSite = [...domainToSite.values()].find((s) => stripWww(s.domain) === targetDomain);
    const livePath = targetSite ? slugToPath.get(targetSite.domain)?.get(slug) : undefined;

    const bucket = perPost.get(r.fromPost.id) ?? {
      actions: [],
      domain: r.fromPost.site.domain,
    };

    if (targetSite && livePath !== undefined && livePath !== "") {
      const newHref = `https://${targetSite.domain}${livePath}`;
      if (newHref === r.toUrl) {
        staleLinkIds.push(r.id); // already correct but flagged; treat as no-op cleanup
      } else {
        bucket.actions.push({ href: r.toUrl, linkId: r.id, newHref, toPostId: undefined });
        if (rewriteSamples.length < 10) {
          rewriteSamples.push(`${r.toUrl}  →  ${newHref}`);
        }
      }
    } else {
      // No HTTP-status branch: the audit records internal/PBN links whose target
      // slug resolves to no Post, never external responses, so a "bot-blocked
      // but valid" case cannot appear in this artifact. Preserving those would
      // need the audit to record status first.
      bucket.actions.push({ href: r.toUrl, linkId: r.id, newHref: null });
      if (stripSamples.length < 12) {
        stripSamples.push(`${r.type}  ${r.toUrl}`);
      }
    }
    perPost.set(r.fromPost.id, bucket);
  }

  const slugToPostId = new Map<string, string>();
  const allPub = await prisma.post.findMany({
    select: { id: true, siteId: true, slug: true },
    where: { status: "PUBLISHED" },
  });
  for (const p of allPub) {
    slugToPostId.set(`${p.siteId}::${p.slug}`, p.id);
  }

  let rewriteCount = 0;
  let stripCount = 0;
  for (const { actions } of perPost.values()) {
    for (const a of actions) {
      if (a.newHref === null) {
        stripCount++;
      } else {
        rewriteCount++;
      }
    }
  }
  console.log(`\n=== PLAN ===`);
  console.log(`stale Link rows to DELETE (not in body): ${staleLinkIds.length}`);
  console.log(`in-body links to REWRITE (real post, wrong url): ${rewriteCount}`);
  console.log(`in-body links to STRIP (fabricated/dead): ${stripCount}`);
  console.log(`posts whose body changes: ${perPost.size}`);
  console.log(`\nsample REWRITES:`);
  for (const s of rewriteSamples) {
    console.log(`  ${s}`);
  }
  console.log(`\nsample STRIPS:`);
  for (const s of stripSamples) {
    console.log(`  ${s}`);
  }
  console.log(`\ncategorySlugMap to set (sample 3 sites):`);
  for (const site of sites.slice(0, 3)) {
    console.log(`  ${site.domain}: ${JSON.stringify(finalCatMap.get(site.id) ?? {})}`);
  }

  if (!APPLY) {
    console.log(`\nDry-run only. Re-run with --apply to write.`);
    await prisma.$disconnect();
    return;
  }

  const affectedSiteIds = new Set<string>();
  const deleteLinkIds = [...staleLinkIds];
  const rewriteUpdates: Array<{ id: string; toPostId: string | null; toUrl: string }> = [];
  const postIds = [...perPost.keys()];
  let processed = 0;
  const applyPost = async (postId: string): Promise<void> => {
    const bucket = perPost.get(postId);
    const post = await prisma.post.findUnique({
      select: { body: true, siteId: true },
      where: { id: postId },
    });
    if (!bucket || !post) {
      return;
    }
    let body = post.body;
    for (const a of bucket.actions) {
      const { body: nb } = editHref(body, a.href, a.newHref);
      body = nb;
      if (a.newHref === null) {
        deleteLinkIds.push(a.linkId);
      } else {
        const tDomain = stripWww(new URL(a.newHref).host);
        const tSite = [...domainToSite.values()].find((s) => stripWww(s.domain) === tDomain);
        const slug = lastSeg(new URL(a.newHref).pathname);
        const toPostId = tSite ? (slugToPostId.get(`${tSite.id}::${slug}`) ?? null) : null;
        rewriteUpdates.push({ id: a.linkId, toPostId, toUrl: a.newHref });
      }
    }
    if (body !== post.body) {
      await prisma.post.update({ data: { body }, where: { id: postId } });
      affectedSiteIds.add(post.siteId);
    }
    processed++;
    if (processed % 25 === 0) {
      console.log(`  bodies updated ${processed}/${postIds.length}`);
    }
  };
  let idx = 0;
  const next = async (): Promise<void> => {
    const i = idx++;
    const postId = postIds[i];
    if (postId === undefined || postId === "") {
      return;
    }
    await applyPost(postId);
    return next();
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, postIds.length) }, () => next()));

  for (let i = 0; i < deleteLinkIds.length; i += 500) {
    await prisma.link.deleteMany({ where: { id: { in: deleteLinkIds.slice(i, i + 500) } } });
  }
  for (const u of rewriteUpdates) {
    await prisma.link.update({
      data: { lastCheckedAt: new Date(), toPostId: u.toPostId, toUrl: u.toUrl },
      where: { id: u.id },
    });
  }

  for (const [siteId, map] of finalCatMap) {
    await prisma.site.update({ data: { categorySlugMap: map }, where: { id: siteId } });
  }

  recordAffectedSites([...affectedSiteIds]);
  console.log(`\n=== APPLIED ===`);
  console.log(`Link rows deleted: ${deleteLinkIds.length}`);
  console.log(`Link rows rewritten: ${rewriteUpdates.length}`);
  console.log(`Sites with body changes (republish): ${affectedSiteIds.size}`);
  console.log(`categorySlugMap populated on ${finalCatMap.size} sites`);
  console.log(`affected site ids → /tmp/easeia-affected-site-ids.json`);

  await prisma.$disconnect();
};

void main();
