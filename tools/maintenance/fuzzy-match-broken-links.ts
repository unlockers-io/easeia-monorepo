/**
 * For each broken target slug, find the closest existing slug on the
 * target site. Reports % of broken links that have a "high-confidence"
 * fuzzy match, i.e. could be rewritten safely rather than stripped.
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";

import { prisma } from "@repo/db";

import { readBrokenLinks, type BrokenLink } from "../_shared/broken-links";

type Hit = BrokenLink;

const trigrams = (s: string): Set<string> => {
  const padded = `  ${s}  `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) {
      inter++;
    }
  }
  return inter / (a.size + b.size - inter);
};

const main = async () => {
  const broken: Array<Hit> = readBrokenLinks();

  const sites = await prisma.site.findMany({ select: { domain: true, id: true } });
  const domainToSiteId = new Map(
    sites.map((s) => [s.domain.replace(/^www\./i, "").toLowerCase(), s.id] as const),
  );

  const posts = await prisma.post.findMany({
    select: { siteId: true, slug: true },
    where: { status: "PUBLISHED" },
  });
  const slugsBySite = new Map<string, Array<{ slug: string; tg: Set<string> }>>();
  for (const p of posts) {
    let list = slugsBySite.get(p.siteId);
    if (!list) {
      list = [];
      slugsBySite.set(p.siteId, list);
    }
    list.push({ slug: p.slug, tg: trigrams(p.slug) });
  }

  const out: Array<Hit & { matchScore: number; matchSlug: string | null }> = [];
  for (const hit of broken) {
    const siteId = domainToSiteId.get(hit.targetSiteDomain.replace(/^www\./i, "").toLowerCase());
    if (siteId === undefined || siteId === "") {
      out.push({ ...hit, matchScore: 0, matchSlug: null });
      continue;
    }
    const candidates = slugsBySite.get(siteId) ?? [];
    const targetTg = trigrams(hit.targetSlug);
    let best: { score: number; slug: string | null } = { score: 0, slug: null };
    for (const c of candidates) {
      const s = jaccard(targetTg, c.tg);
      if (s > best.score) {
        best = { score: s, slug: c.slug };
      }
    }
    out.push({ ...hit, matchScore: Math.round(best.score * 1000) / 1000, matchSlug: best.slug });
  }

  const buckets = { good: 0, none: 0, strong: 0, weak: 0 };
  for (const r of out) {
    if (r.matchScore >= 0.7) {
      buckets.strong++;
    } else if (r.matchScore >= 0.5) {
      buckets.good++;
    } else if (r.matchScore >= 0.3) {
      buckets.weak++;
    } else {
      buckets.none++;
    }
  }

  console.log(`\n=== fuzzy match buckets (n=${out.length}) ===`);
  console.log(`  strong (≥0.7):   ${buckets.strong}`);
  console.log(`  good   (≥0.5):   ${buckets.good}`);
  console.log(`  weak   (≥0.3):   ${buckets.weak}`);
  console.log(`  none   (<0.3):   ${buckets.none}`);

  console.log(`\n=== sample strong matches ===`);
  const strong = out.filter((r) => r.matchScore >= 0.7).slice(0, 12);
  for (const r of strong) {
    console.log(`  ${r.matchScore.toFixed(2)}  ${r.targetSiteDomain}`);
    console.log(`         broken:  ${r.targetSlug}`);
    console.log(`         match:   ${r.matchSlug}`);
  }

  console.log(`\n=== sample 0.5–0.7 matches ===`);
  const good = out.filter((r) => r.matchScore >= 0.5 && r.matchScore < 0.7).slice(0, 8);
  for (const r of good) {
    console.log(`  ${r.matchScore.toFixed(2)}  ${r.targetSiteDomain}`);
    console.log(`         broken:  ${r.targetSlug}`);
    console.log(`         match:   ${r.matchSlug}`);
  }

  writeFileSync("/tmp/easeia-broken-links-with-matches.json", JSON.stringify(out, null, 2));
  console.log(`\nwrote /tmp/easeia-broken-links-with-matches.json`);

  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
