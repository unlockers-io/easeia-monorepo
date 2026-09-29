/**
 * Dry-run by default. --apply writes title/excerpt (LLM) and inbound "see also"
 * links. Redeploy via tools/maintenance/redeploy-affected-sites.ts after apply.
 */
import "dotenv/config";

import { generateSeoSuggestions } from "@repo/ai";
import { LinkType, PostStatus, prisma } from "@repo/db";
import { classifyDescriptionLength, classifyTitleLength, summarizeOnPage } from "@repo/health";
import { liveLinkWhere } from "@repo/links";

import { AFFECTED_SITES_FILE, recordAffectedSites } from "../_shared/affected-sites";

import { applyInboundFix, type ListedPost, planInboundFixes } from "./inbound";

const APPLY = process.argv.includes("--apply");
const SKIP_META = process.argv.includes("--skip-meta");
const SKIP_LINKS = process.argv.includes("--skip-links");
const META_BATCH = 5;

const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const SITE = argValue("--site");

const selectPosts = async (siteId: string | undefined): Promise<Array<ListedPost>> =>
  prisma.post.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      categories: true,
      excerpt: true,
      id: true,
      siteId: true,
      slug: true,
      title: true,
    },
    where: {
      siteId,
      status: PostStatus.PUBLISHED,
    },
  });

const inboundCounts = async (posts: ReadonlyArray<ListedPost>): Promise<Map<string, number>> => {
  const counts = new Map<string, number>();
  if (posts.length === 0) {
    return counts;
  }
  const inbound = await prisma.link.groupBy({
    _count: { toPostId: true },
    by: ["toPostId"],
    where: {
      ...liveLinkWhere,
      fromPost: { status: PostStatus.PUBLISHED },
      toPostId: { in: posts.map((p) => p.id) },
      type: LinkType.INTERNAL,
    },
  });
  for (const row of inbound) {
    if (row.toPostId !== null) {
      counts.set(row.toPostId, row._count.toPostId);
    }
  }
  return counts;
};

type MetaTarget = ListedPost & { fixDescription: boolean; fixTitle: boolean };

const metaTargets = (posts: ReadonlyArray<ListedPost>): Array<MetaTarget> =>
  posts.flatMap((post) => {
    const fixTitle = classifyTitleLength(post.title) !== "ok";
    const fixDescription = classifyDescriptionLength(post.excerpt) !== "ok";
    return fixTitle || fixDescription ? [{ ...post, fixDescription, fixTitle }] : [];
  });

type MetaOutcome = { id: string; reason?: string; siteId: string; status: "fixed" | "skipped" };

const fixMetaOne = async (post: MetaTarget): Promise<MetaOutcome> => {
  const row = await prisma.post.findUnique({
    select: {
      body: true,
      excerpt: true,
      focusKeyword: true,
      site: { select: { domain: true, language: true } },
      title: true,
    },
    where: { id: post.id },
  });
  if (!row) {
    return { id: post.id, reason: "not found", siteId: post.siteId, status: "skipped" };
  }

  const suggestion = await generateSeoSuggestions({
    currentDescription: row.excerpt ?? undefined,
    currentFocusKeyword: row.focusKeyword ?? undefined,
    currentTitle: row.title,
    htmlContent: row.body,
    locale: row.site.language,
    postTitle: row.title,
    siteDomain: row.site.domain,
  });

  const nextTitle = post.fixTitle ? suggestion.title : row.title;
  const nextExcerpt = post.fixDescription ? suggestion.description : row.excerpt;
  if (post.fixTitle && classifyTitleLength(nextTitle) !== "ok") {
    return {
      id: post.id,
      reason: `model title still ${classifyTitleLength(nextTitle)}`,
      siteId: post.siteId,
      status: "skipped",
    };
  }
  if (post.fixDescription && classifyDescriptionLength(nextExcerpt) !== "ok") {
    return {
      id: post.id,
      reason: `model description still ${classifyDescriptionLength(nextExcerpt)}`,
      siteId: post.siteId,
      status: "skipped",
    };
  }

  if (APPLY) {
    await prisma.post.update({
      data: { excerpt: nextExcerpt, title: nextTitle },
      where: { id: post.id },
    });
  }
  return { id: post.id, siteId: post.siteId, status: "fixed" };
};

const printSummary = (label: string, counts: ReturnType<typeof summarizeOnPage>): void => {
  console.log(`\n${label}`);
  console.log(`  published                  ${counts.published}`);
  console.log(`  title too long             ${counts.titleTooLong}`);
  console.log(`  title too short            ${counts.titleTooShort}`);
  console.log(`  meta description too short ${counts.descriptionTooShort}`);
  console.log(`  meta description too long  ${counts.descriptionTooLong}`);
  console.log(`  no in-content inbound      ${counts.noInboundInternal}`);
};

const runInboundPass = async (
  posts: ReadonlyArray<ListedPost>,
  inbound: ReadonlyMap<string, number>,
  affected: Set<string>,
): Promise<void> => {
  const orphans = posts.filter((p) => (inbound.get(p.id) ?? 0) === 0);
  console.log(`\nInbound pass: ${orphans.length} posts with 0 in-content inbound links`);
  const planned = await planInboundFixes(orphans);
  console.log(`  planned source→orphan links: ${planned.length}`);
  if (!APPLY) {
    return;
  }
  const postsById = new Map(posts.map((p) => [p.id, p]));
  for (const fix of planned) {
    await applyInboundFix(fix, postsById);
    affected.add(fix.siteId);
  }
  console.log(`  wrote ${planned.length} inbound links`);
};

const settleMetaBatch = (
  batch: ReadonlyArray<MetaTarget>,
  settled: ReadonlyArray<PromiseSettledResult<MetaOutcome>>,
  affected: Set<string>,
) => {
  let fixed = 0;
  let skipped = 0;
  for (const [j, res] of settled.entries()) {
    const target = batch.at(j);
    if (target === undefined) {
      continue;
    }
    if (res.status === "fulfilled" && res.value.status === "fixed") {
      fixed += 1;
      affected.add(target.siteId);
      continue;
    }
    skipped += 1;
    const reason =
      res.status === "fulfilled" ? (res.value.reason ?? "skipped") : String(res.reason);
    console.log(`  skip ${target.slug}: ${reason}`);
  }
  return { fixed, skipped };
};

const runMetaPass = async (
  posts: ReadonlyArray<ListedPost>,
  affected: Set<string>,
): Promise<void> => {
  const targets = metaTargets(posts);
  console.log(`\nMeta pass: ${targets.length} posts with title/excerpt out of range`);
  if (!APPLY) {
    const sample = targets.slice(0, 8);
    for (const t of sample) {
      const bits = [
        t.fixTitle ? `title ${t.title.length}ch` : null,
        t.fixDescription ? `excerpt ${t.excerpt?.length ?? 0}ch` : null,
      ].filter((bit): bit is string => bit !== null);
      console.log(`  ${t.slug}  ${bits.join(", ")}`);
    }
    if (targets.length > sample.length) {
      console.log(`  … +${targets.length - sample.length} more`);
    }
    return;
  }
  let fixed = 0;
  let skipped = 0;
  for (let i = 0; i < targets.length; i += META_BATCH) {
    const batch = targets.slice(i, i + META_BATCH);
    const settled = await Promise.allSettled(batch.map(fixMetaOne));
    const step = settleMetaBatch(batch, settled, affected);
    fixed += step.fixed;
    skipped += step.skipped;
    console.log(`  processed ${Math.min(i + META_BATCH, targets.length)}/${targets.length}`);
  }
  console.log(`  fixed=${fixed} skipped=${skipped}`);
};

const main = async (): Promise<number> => {
  const site =
    SITE === undefined || SITE === ""
      ? null
      : await prisma.site.findUnique({
          select: { domain: true, id: true },
          where: { domain: SITE },
        });
  if (SITE !== undefined && SITE !== "" && site === null) {
    console.error(`unknown site ${SITE}`);
    return 1;
  }

  const posts = await selectPosts(site?.id);
  const inbound = await inboundCounts(posts);
  printSummary(
    `On-page SEO ${site === null ? "network-wide" : `on ${site.domain}`} (${APPLY ? "APPLY" : "dry run"})`,
    summarizeOnPage(
      posts.map((p) => ({
        excerpt: p.excerpt,
        inboundInternal: inbound.get(p.id) ?? 0,
        title: p.title,
      })),
    ),
  );

  const affected = new Set<string>();
  if (!SKIP_LINKS) {
    await runInboundPass(posts, inbound, affected);
  }
  if (!SKIP_META) {
    await runMetaPass(posts, affected);
  }

  if (APPLY) {
    if (affected.size > 0) {
      recordAffectedSites([...affected]);
      console.log(`\n${affected.size} affected site ids → ${AFFECTED_SITES_FILE}`);
      console.log("Next: `tsx tools/maintenance/redeploy-affected-sites.ts` to trigger rebuilds.");
    }
  } else {
    console.log("\nDry run — no writes. Re-run with --apply to persist.");
  }
  return 0;
};

try {
  const code = await main();
  await prisma.$disconnect();
  process.exit(code);
} catch (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
