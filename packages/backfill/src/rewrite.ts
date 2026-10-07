import { JobKind, PostStatus, type Prisma, prisma } from "@repo/db";
import { enqueue, type JobPayloads } from "@repo/jobs";

import { createBackfill } from "./backfill";

type RewritePhase = JobPayloads["BACKFILL_REWRITE"]["phase"];

export type RewriteCounts = {
  moneySitePagesCrawled: number;
  moneySitePagesTotal: number;
  postsEligible: number;
  postsRewritten: number;
};

export const nextRewritePhase = (
  phase: RewritePhase,
  counts: RewriteCounts,
): RewritePhase | "DONE" => {
  if (phase === "CRAWL_MONEY_SITE") {
    return counts.moneySitePagesTotal > 0 &&
      counts.moneySitePagesCrawled >= counts.moneySitePagesTotal
      ? "REWRITE_POST"
      : "CRAWL_MONEY_SITE";
  }
  return counts.postsRewritten >= counts.postsEligible ? "DONE" : "REWRITE_POST";
};

const eligiblePosts = (force: boolean): Prisma.PostWhereInput =>
  force ? { status: PostStatus.PUBLISHED } : { rewrittenAt: null, status: PostStatus.PUBLISHED };

const readRewriteCounts = async ({
  initialPostsEligible,
  startedAt,
}: JobPayloads["BACKFILL_REWRITE"]): Promise<RewriteCounts> => {
  const since = new Date(startedAt);
  const [moneySitePagesTotal, moneySitePagesCrawled, postsRewritten] = await Promise.all([
    prisma.moneySitePage.count({ where: { moneySite: { isEnabled: true } } }),
    prisma.moneySitePage.count({
      where: { lastCrawledAt: { gte: since }, moneySite: { isEnabled: true } },
    }),
    prisma.post.count({ where: { rewrittenAt: { gte: since }, status: PostStatus.PUBLISHED } }),
  ]);
  return {
    moneySitePagesCrawled,
    moneySitePagesTotal,
    postsEligible: initialPostsEligible,
    postsRewritten,
  };
};

export const rewriteBackfill = createBackfill({
  failureKinds: [
    JobKind.BACKFILL_REWRITE,
    JobKind.CRAWL_MONEY_SITE,
    JobKind.CRAWL_MONEY_SITE_PAGE,
    JobKind.REWRITE_POST,
  ],
  fanout: async (phase, { force }) => {
    if (phase === "CRAWL_MONEY_SITE") {
      const moneySites = await prisma.moneySite.findMany({
        select: { id: true },
        where: { isEnabled: true },
      });
      return moneySites.map((moneySite) => ({
        id: moneySite.id,
        run: async () => {
          await enqueue({ kind: JobKind.CRAWL_MONEY_SITE, payload: { moneySiteId: moneySite.id } });
        },
      }));
    }
    const posts = await prisma.post.findMany({ select: { id: true }, where: eligiblePosts(force) });
    return posts.map((post) => ({
      id: post.id,
      run: async () => {
        await enqueue({
          kind: JobKind.REWRITE_POST,
          payload: { force, postId: post.id },
          postId: post.id,
        });
      },
    }));
  },
  initialPayload: async ({ force }: { force: boolean }) => ({
    force,
    initialPostsEligible: await prisma.post.count({ where: eligiblePosts(force) }),
    phase: "CRAWL_MONEY_SITE",
    startedAt: new Date().toISOString(),
  }),
  kind: JobKind.BACKFILL_REWRITE,
  label: "network rewrite",
  nextPhase: nextRewritePhase,
  readCounts: readRewriteCounts,
});
