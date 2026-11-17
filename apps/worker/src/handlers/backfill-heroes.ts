import { JobKind } from "@repo/db";
import { enqueue } from "@repo/jobs";
import * as Posts from "@repo/posts";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

const CAP = 25;

export const handleBackfillHeroes = async ({
  log,
}: JobContext<"BACKFILL_HEROES">): Promise<void> => {
  const posts = await Posts.listHeroless(prisma, CAP);

  await prisma.$transaction(async (tx) => {
    for (const post of posts) {
      await enqueue(tx, {
        kind: JobKind.GENERATE_IMAGE,
        payload: { postId: post.id },
        postId: post.id,
        siteId: post.siteId,
      });
    }
  });

  log.set({ enqueued: posts.length, truncated: posts.length === CAP });
  log.info("hero-backfill: swept");
};
