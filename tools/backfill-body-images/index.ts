// Each job spends image-generation credits and rewrites a live body, so runs
// require an explicit limit or --all. See README.md for dry-run instructions.
import "dotenv/config";

import { JobKind, type Prisma, prisma } from "@repo/db";
import { closeJobs, enqueue } from "@repo/jobs";

const COST_PER_POST_USD = 0.17;

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing env var: ${key}`);
  }
  return value;
};

type Args = {
  all: boolean;
  dryRun: boolean;
  limit: number | null;
  siteId: string | null;
};

const flagValue = (argv: ReadonlyArray<string>, flag: string): string | null => {
  const index = argv.indexOf(flag);
  return index === -1 ? null : (argv[index + 1] ?? null);
};

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  const all = argv.includes("--all");
  const rawLimit = flagValue(argv, "--limit");
  const limit = rawLimit === null ? null : Math.trunc(Number(rawLimit));
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error(`--limit must be a positive integer, got "${rawLimit}"`);
  }
  if (!all && limit === null) {
    throw new Error("Pass --limit <n> to bound the run, or --all to sweep every eligible post.");
  }
  return { all, dryRun: argv.includes("--dry-run"), limit, siteId: flagValue(argv, "--site") };
};

const main = async (): Promise<number> => {
  const args = parseArgs(process.argv.slice(2));
  const redisUrl = args.dryRun ? "" : requireEnv("REDIS_URL");
  // The worker rechecks this predicate before modifying a post.
  const where: Prisma.PostWhereInput = {
    body: { not: { contains: "![" } },
    status: "PUBLISHED",
  };
  if (args.siteId !== null) {
    where.siteId = args.siteId;
  }

  const posts = await prisma.post.findMany({
    orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, siteId: true, slug: true },
    take: args.limit ?? undefined,
    where,
  });

  if (posts.length === 0) {
    console.log("No published posts are missing body images.");
    return 0;
  }

  const estimate = (posts.length * COST_PER_POST_USD).toFixed(2);
  if (args.dryRun) {
    console.log(`Would enqueue GENERATE_BODY_IMAGES for ${posts.length} posts (~$${estimate}).`);
    for (const post of posts.slice(0, 10)) {
      console.log(`  ${post.slug}`);
    }
    if (posts.length > 10) {
      console.log(`  … and ${posts.length - 10} more`);
    }
    return 0;
  }

  console.log(`Enqueuing GENERATE_BODY_IMAGES for ${posts.length} posts (~$${estimate})…`);

  let enqueued = 0;
  let failed = 0;
  for (const post of posts) {
    try {
      await enqueue({
        kind: JobKind.GENERATE_BODY_IMAGES,
        payload: { postId: post.id },
        postId: post.id,
        redisUrl,
        siteId: post.siteId,
      });
      enqueued++;
      if (enqueued % 50 === 0) {
        console.log(`  ${enqueued}/${posts.length}`);
      }
    } catch (error) {
      failed++;
      console.error(`  ✗ ${post.slug}: ${String(error)}`);
    }
  }

  console.log(`Done. enqueued=${enqueued} failed=${failed}`);
  return failed > 0 ? 1 : 0;
};

const cleanup = async (): Promise<void> => {
  await Promise.allSettled([prisma.$disconnect(), closeJobs()]);
};

let exitCode = 0;
try {
  exitCode = await main();
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await cleanup();
}
process.exit(exitCode);
