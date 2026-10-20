import { assertAiConfigured } from "@repo/ai";
import { JobKind, PostStatus, prisma } from "@repo/db";
import { enqueue } from "@repo/jobs";
import * as Sites from "@repo/sites";

import { completed, createBackfill } from "./backfill";

export const rewriteBackfill = createBackfill({
  counts: (run, jobs) => ({
    moneySitePagesCrawled: completed(jobs, JobKind.CRAWL_MONEY_SITE_PAGE),
    moneySitePagesTotal: jobs.filter((job) => job.kind === JobKind.CRAWL_MONEY_SITE_PAGE).length,
    postsEligible: run.postIds.length,
    postsRewritten: completed(jobs, JobKind.REWRITE_POST),
  }),
  kind: JobKind.BACKFILL_REWRITE,
  label: "network rewrite",
  members: async ({ force }: { force: boolean }) => {
    assertAiConfigured();
    const sites = await Sites.list();
    const [posts, moneySites] = await Promise.all([
      prisma.post.findMany({
        select: { id: true },
        where: {
          siteId: {
            in: sites
              .filter((site) => site.isEnabled && Sites.hasDeployHook(site))
              .map((site) => site.id),
          },
          status: PostStatus.PUBLISHED,
          ...(force ? {} : { rewrittenAt: null }),
        },
      }),
      prisma.moneySite.findMany({ select: { id: true }, where: { isEnabled: true } }),
    ]);
    return {
      force,
      moneySiteIds: moneySites.map((site) => site.id),
      postIds: posts.map((post) => post.id),
    };
  },
  phases: [
    {
      enqueue: async (run, tx) => {
        for (const moneySiteId of run.moneySiteIds) {
          await enqueue(
            {
              kind: JobKind.CRAWL_MONEY_SITE,
              payload: { moneySiteId },
              run: { id: run.id, member: moneySiteId, phase: "CRAWL_MONEY_SITE" },
            },
            tx,
          );
        }
      },
      name: "CRAWL_MONEY_SITE",
    },
    {
      enqueue: async (run, tx) => {
        for (const postId of run.postIds) {
          await enqueue(
            {
              kind: JobKind.REWRITE_POST,
              payload: { force: run.force, postId },
              postId,
              run: { id: run.id, member: postId, phase: "REWRITE_POST" },
            },
            tx,
          );
        }
      },
      name: "REWRITE_POST",
    },
  ],
});
