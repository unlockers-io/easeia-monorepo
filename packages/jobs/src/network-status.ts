import { JobKind, prisma } from "@repo/db";

import { readBackfillNetworkCounts } from "./backfill-network";
import { countEligibleRewritePosts, readBackfillRewriteCounts } from "./backfill-rewrite";
import { readOrchestratorStatus } from "./orchestrator-status";

export const readBackfillNetworkStatus = readOrchestratorStatus({
  failureKinds: [JobKind.BACKFILL_NETWORK, JobKind.CLASSIFY, JobKind.EMBED, JobKind.SUGGEST_LINKS],
  fallbackPhase: "CLASSIFY_EMBED",
  kind: JobKind.BACKFILL_NETWORK,
  loadCounts: async ({ startedAt }) => {
    const [counts, sites] = await Promise.all([
      readBackfillNetworkCounts(startedAt),
      prisma.site.count({ where: { isEnabled: true } }),
    ]);
    return {
      classifiedPosts: counts.classifiedPosts,
      embeddedPosts: counts.embeddedPosts,
      posts: counts.posts,
      sites,
      suggestDone: counts.suggestLinksDone,
    };
  },
});

export const readBackfillRewriteStatus = readOrchestratorStatus({
  failureKinds: [
    JobKind.BACKFILL_REWRITE,
    JobKind.CRAWL_MONEY_SITE,
    JobKind.CRAWL_MONEY_SITE_PAGE,
    JobKind.REWRITE_POST,
  ],
  fallbackPhase: "CRAWL_MONEY_SITE",
  kind: JobKind.BACKFILL_REWRITE,
  loadCounts: async ({ payload, startedAt }) => {
    const initialPostsEligible =
      payload.initialPostsEligible ?? (await countEligibleRewritePosts(payload.force === true));
    const counts = await readBackfillRewriteCounts(startedAt, initialPostsEligible);
    return {
      moneySitePagesCrawled: counts.moneySitePagesCrawled,
      moneySitePagesTotal: counts.moneySitePagesTotal,
      postsEligible: counts.postsEligible,
      postsRewritten: counts.postsRewritten,
    };
  },
});
