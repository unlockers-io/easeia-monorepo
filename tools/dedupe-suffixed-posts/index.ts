/**
 * Dry-run by default; --apply moves the longest body onto the base slug and
 * archives the copies. Ship the /<category>/<slug>/ redirects before --apply:
 * moving a body redeploys its Site, and that build drops the archived copies.
 */
import "dotenv/config";

import { prisma } from "@repo/db";
import { closeJobs } from "@repo/jobs";
import { reviseBody, unpublish } from "@repo/posts";

import { groupSuffixedPosts, longestBody } from "./group";

const APPLY = process.argv.includes("--apply");

const main = async (): Promise<void> => {
  const sites = await prisma.site.findMany({ select: { domain: true, id: true } });
  const domainById = new Map(sites.map((site) => [site.id, site.domain]));
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
  });

  const redirects = new Map<string, Array<{ from: string; to: string }>>();
  const groups = groupSuffixedPosts(posts);

  let dupeCount = 0;

  for (const { base, dupes } of groups) {
    const domain = domainById.get(base.siteId) ?? "?";
    const source = longestBody([base, ...dupes]);
    dupeCount += dupes.length;

    console.log(`\n${domain}`);
    console.log(`  keep    /${base.slug}`);
    for (const dupe of dupes) {
      console.log(`  archive /${dupe.slug}`);
    }
    console.log(
      `  body from ${source.id === base.id ? "the base" : `/${source.slug}`} (${source.body.length} chars, longest of ${dupes.length + 1})`,
    );

    const entries = redirects.get(domain) ?? [];
    for (const dupe of dupes) {
      entries.push({ from: dupe.slug, to: base.slug });
    }
    redirects.set(domain, entries);

    if (APPLY) {
      if (source.id !== base.id) {
        await reviseBody(base.id, {
          body: source.body,
          excerpt: source.excerpt,
          from: base.body,
          title: source.title,
        });
      }
      for (const dupe of dupes) {
        await unpublish(dupe.id);
      }
    }
  }

  console.log(`\nbases: ${groups.length}; suffixed copies archived: ${dupeCount}`);
  console.log("\n=== slugs needing a redirect, per blog ===");
  for (const [domain, entries] of redirects) {
    console.log(`\n${domain}`);
    for (const entry of entries) {
      console.log(`  ${entry.from}  ->  ${entry.to}`);
    }
  }

  if (!APPLY) {
    console.log("\ndry run; pass --apply to write");
    return;
  }
  console.log(`\nresolved ${groups.length} bases; ship the redirects above to publish them`);
};

try {
  await main();
} finally {
  await Promise.allSettled([prisma.$disconnect(), closeJobs()]);
}
