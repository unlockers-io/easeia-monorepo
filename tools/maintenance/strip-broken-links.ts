import "dotenv/config";

import { prisma } from "@repo/db";

import { recordAffectedSites } from "../_shared/affected-sites";
import { readBrokenLinks, type BrokenLink } from "../_shared/broken-links";

type BrokenHit = BrokenLink;

const APPLY = process.argv.includes("--apply");

const escapeRegex = (s: string): string => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const stripLink = (body: string, href: string): { body: string; replaced: number } => {
  const h = escapeRegex(href);
  let replaced = 0;

  const mdRe = new RegExp(`\\[([^\\]]+)\\]\\(${h}(?:\\s+"[^"]*")?\\)`, "gv");
  let next = body.replace(mdRe, (_full: string, anchor: string) => {
    replaced++;
    return anchor;
  });

  const htmlRe = new RegExp(`<a\\s[^>]*href=["']${h}["'][^>]*>([\\s\\S]*?)</a>`, "giv");
  next = next.replace(htmlRe, (_full: string, inner: string) => {
    replaced++;
    return inner;
  });

  return { body: next, replaced };
};

const main = async () => {
  const broken: Array<BrokenHit> = readBrokenLinks();

  const byPost = new Map<string, Array<BrokenHit>>();
  for (const h of broken) {
    let list = byPost.get(h.fromPostId);
    if (!list) {
      list = [];
      byPost.set(h.fromPostId, list);
    }
    list.push(h);
  }

  console.log(`posts to process:   ${byPost.size}`);
  console.log(`broken links:       ${broken.length}`);
  console.log(`mode:               ${APPLY ? "WRITE" : "DRY-RUN"}`);

  const affectedSiteIds = new Set<string>();
  const stats = { linksRemoved: 0, missing: 0, postsUnchanged: 0, postsUpdated: 0 };
  const samples: Array<{ after: string; before: string; href: string; slug: string }> = [];

  for (const [postId, hits] of byPost) {
    const post = await prisma.post.findUnique({
      select: { body: true, id: true, siteId: true, slug: true },
      where: { id: postId },
    });
    if (!post) {
      stats.missing++;
      continue;
    }

    const uniqueHrefs = [...new Set(hits.map((h) => h.rawHref))];

    let newBody = post.body;
    let totalReplaced = 0;
    for (const href of uniqueHrefs) {
      const { body: nb, replaced } = stripLink(newBody, href);
      if (replaced > 0 && samples.length < 8) {
        const idx = newBody.indexOf(href);
        const start = Math.max(0, idx - 60);
        samples.push({
          after: nb.slice(start, Math.max(0, idx - 60) + 180),
          before: newBody.slice(start, start + 180),
          href,
          slug: post.slug,
        });
      }
      newBody = nb;
      totalReplaced += replaced;
    }

    if (newBody === post.body) {
      stats.postsUnchanged++;
      continue;
    }

    stats.postsUpdated++;
    stats.linksRemoved += totalReplaced;
    affectedSiteIds.add(post.siteId);

    if (APPLY) {
      await prisma.post.update({
        data: { body: newBody },
        where: { id: postId },
      });
    }
  }

  console.log(`\n=== sample replacements ===`);
  for (const s of samples) {
    console.log(`\n  post: ${s.slug}`);
    console.log(`  href: ${s.href}`);
    console.log(`  BEFORE: ${s.before.replaceAll("\n", " ")}`);
    console.log(`  AFTER:  ${s.after.replaceAll("\n", " ")}`);
  }

  console.log(`\n=== result ===`);
  console.log(`posts updated:   ${stats.postsUpdated}`);
  console.log(`posts unchanged: ${stats.postsUnchanged}`);
  console.log(`posts missing:   ${stats.missing}`);
  console.log(`links removed:   ${stats.linksRemoved}`);
  console.log(`sites affected:  ${affectedSiteIds.size}`);

  recordAffectedSites([...affectedSiteIds]);
  console.log(`\nwrote /tmp/easeia-affected-site-ids.json`);

  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
