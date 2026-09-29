import { PostStatus, prisma } from "@repo/db";
import type { Prisma } from "@repo/db";

type BackfillRewritePhase = "CRAWL_MONEY_SITE" | "REWRITE_POST" | "DONE";

type BackfillRewritePayload = {
  force?: boolean;
  initialFanoutDone?: boolean;
  initialPostsEligible?: number;
  phase: BackfillRewritePhase;
  startedAt: string;
};

type BackfillRewriteCounts = {
  moneySitePagesCrawled: number;
  moneySitePagesTotal: number;
  postsEligible: number;
  postsRewritten: number;
};

const nextBackfillRewritePhase = (
  current: BackfillRewritePhase,
  counts: BackfillRewriteCounts,
): BackfillRewritePhase => {
  switch (current) {
    case "CRAWL_MONEY_SITE": {
      return counts.moneySitePagesCrawled >= counts.moneySitePagesTotal &&
        counts.moneySitePagesTotal > 0
        ? "REWRITE_POST"
        : "CRAWL_MONEY_SITE";
    }
    case "DONE": {
      return "DONE";
    }
    case "REWRITE_POST": {
      return counts.postsRewritten >= counts.postsEligible ? "DONE" : "REWRITE_POST";
    }
    default: {
      return current;
    }
  }
};

const eligibleRewritePostsWhere = (force: boolean): Prisma.PostWhereInput =>
  force ? { status: PostStatus.PUBLISHED } : { rewrittenAt: null, status: PostStatus.PUBLISHED };

const countEligibleRewritePosts = (force: boolean): Promise<number> =>
  prisma.post.count({ where: eligibleRewritePostsWhere(force) });

const readBackfillRewriteCounts = async (
  startedAt: Date,
  initialPostsEligible: number,
): Promise<BackfillRewriteCounts> => {
  const [moneySitePagesTotal, moneySitePagesCrawled, postsRewritten] = await Promise.all([
    prisma.moneySitePage.count({
      where: { moneySite: { isEnabled: true } },
    }),
    prisma.moneySitePage.count({
      where: { lastCrawledAt: { gte: startedAt }, moneySite: { isEnabled: true } },
    }),
    prisma.post.count({
      where: { rewrittenAt: { gte: startedAt }, status: PostStatus.PUBLISHED },
    }),
  ]);
  return {
    moneySitePagesCrawled,
    moneySitePagesTotal,
    postsEligible: initialPostsEligible,
    postsRewritten,
  };
};

export {
  countEligibleRewritePosts,
  eligibleRewritePostsWhere,
  nextBackfillRewritePhase,
  readBackfillRewriteCounts,
};
export type { BackfillRewriteCounts, BackfillRewritePayload, BackfillRewritePhase };
