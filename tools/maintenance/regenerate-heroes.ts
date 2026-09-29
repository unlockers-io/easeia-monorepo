import "dotenv/config";

import { remove } from "@repo/blob";
import { prisma } from "@repo/db";
import { generateHero } from "@repo/hero";

import { AFFECTED_SITES_FILE, recordAffectedSites } from "../_shared/affected-sites";

const DEFAULT_SINCE_DAYS = 45;
const USD_PER_IMAGE = 0.041;
const PAUSE_MS = 1500;
const FAILURE_PAUSE_MS = 5000;

const APPLY = process.argv.includes("--apply");

const flagValue = (name: string): string | undefined => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) {
    return undefined;
  }
  return process.argv[idx + 1];
};

const numberFlag = (name: string, fallback: number | undefined): number | undefined => {
  const raw = flagValue(name);
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Math.trunc(Number(raw));
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`--${name} expects a non-negative integer, got "${raw}"`);
  }
  return parsed;
};

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

type Failure = { domain: string; error: string; slug: string };

const main = async (): Promise<number> => {
  const sinceDays = numberFlag("since", DEFAULT_SINCE_DAYS) ?? DEFAULT_SINCE_DAYS;
  const limit = numberFlag("limit", undefined);
  const offset = numberFlag("offset", 0) ?? 0;
  const siteDomain = flagValue("site");
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      categories: true,
      id: true,
      images: { select: { blobKey: true }, where: { isHero: true } },
      site: { select: { domain: true, imageStyle: true } },
      siteId: true,
      slug: true,
      tags: true,
      title: true,
    },
    skip: offset,
    take: limit,
    where: {
      createdAt: { gt: since },
      images: { some: { isHero: true } },
      site: siteDomain === undefined ? undefined : { domain: siteDomain },
    },
  });

  if (posts.length === 0) {
    console.log("No posts matched. Nothing to regenerate.");
    return 0;
  }

  const bySite = new Map<string, number>();
  for (const post of posts) {
    bySite.set(post.site.domain, (bySite.get(post.site.domain) ?? 0) + 1);
  }
  console.log(
    `${posts.length} posts across ${bySite.size} sites, created after ${since.toISOString().slice(0, 10)} (${APPLY ? "APPLY" : "dry run"}).`,
  );
  console.log(`Estimated spend: $${(posts.length * USD_PER_IMAGE).toFixed(2)}\n`);
  // oxlint-disable-next-line no-array-sort -- sorts a fresh copy of the Map entries; nothing shared is mutated
  const perSite = [...bySite.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [domain, count] of perSite) {
    console.log(`  ${domain.padEnd(26)} ${count}`);
  }

  if (!APPLY) {
    console.log("\nDry run, no images generated. Re-run with --apply to regenerate.");
    return 0;
  }

  const affectedSiteIds = new Set<string>();
  const failures: Array<Failure> = [];
  let done = 0;

  for (const post of posts) {
    const staleKeys = post.images.map((image) => image.blobKey);
    try {
      await generateHero({
        post: {
          categories: post.categories,
          id: post.id,
          siteId: post.siteId,
          slug: post.slug,
          tags: post.tags,
          title: post.title,
        },
        site: post.site,
      });
      affectedSiteIds.add(post.siteId);
      done++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ domain: post.site.domain, error: message, slug: post.slug });
      console.warn(`  FAIL ${post.site.domain}/${post.slug}: ${message}`);
      await sleep(FAILURE_PAUSE_MS);
      continue;
    }

    // The blob key is a hash of the bytes, so a regenerated image lands on a
    // new key and the PostImage row now points elsewhere. Delete the
    // superseded object or R2 accumulates one orphan per regeneration.
    const removals = await Promise.allSettled(staleKeys.map((key) => remove(key)));
    for (const removal of removals) {
      if (removal.status === "rejected") {
        console.warn(`  orphan blob left behind for ${post.slug}: ${String(removal.reason)}`);
      }
    }

    if (done % 10 === 0) {
      console.log(`  ${done}/${posts.length} (failed ${failures.length})`);
    }
    await sleep(PAUSE_MS);
  }

  recordAffectedSites([...affectedSiteIds]);
  console.log(
    `\nRegenerated ${done}, failed ${failures.length}. ${affectedSiteIds.size} affected site ids → ${AFFECTED_SITES_FILE}`,
  );
  for (const failure of failures) {
    console.log(`  [fail] ${failure.domain}/${failure.slug}: ${failure.error}`);
  }
  console.log("Next: `tsx tools/maintenance/redeploy-affected-sites.ts` to trigger rebuilds.");
  return failures.length > 0 ? 1 : 0;
};

const cleanup = async (): Promise<void> => {
  await Promise.allSettled([prisma.$disconnect()]);
};

try {
  const code = await main();
  await cleanup();
  process.exit(code);
} catch (error) {
  console.error(error);
  await cleanup();
  process.exit(1);
}
