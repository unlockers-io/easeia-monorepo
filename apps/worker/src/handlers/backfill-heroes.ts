import { JobKind, prisma } from "@repo/db";
import { enqueue } from "@repo/jobs";
import { log } from "@repo/observability";
import * as Posts from "@repo/posts";

const CAP = 25;

export const handleBackfillHeroes = async (): Promise<void> => {
  const posts = await Posts.listHeroless(CAP);

  await prisma.$transaction(async (tx) => {
    for (const post of posts) {
      await enqueue(
        {
          kind: JobKind.GENERATE_IMAGE,
          payload: { postId: post.id },
          postId: post.id,
          siteId: post.siteId,
        },
        tx,
      );
    }
  });

  log.info({
    enqueued: posts.length,
    message: "hero-backfill: swept",
    truncated: posts.length === CAP,
  });
};
