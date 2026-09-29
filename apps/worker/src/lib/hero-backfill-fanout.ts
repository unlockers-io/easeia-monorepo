import { JobKind, PostStatus, prisma } from "@repo/db";
import { enqueue, fanoutRejections } from "@repo/jobs";

import { log } from "./logger";

const CAP = 25;

type HerolessPost = { id: string; siteId: string };

type Deps = {
  enqueueJob: typeof enqueue;
  findHeroless: () => Promise<Array<HerolessPost>>;
};

const defaultFindHeroless = (): Promise<Array<HerolessPost>> =>
  prisma.post.findMany({
    orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, siteId: true },
    take: CAP,
    where: { images: { none: { isHero: true } }, status: PostStatus.PUBLISHED },
  });

export const makeBackfillHeroes =
  ({ enqueueJob, findHeroless }: Deps) =>
  async (redisUrl: string): Promise<{ enqueued: number }> => {
    const posts = await findHeroless();
    if (posts.length === 0) {
      return { enqueued: 0 };
    }
    const results = await Promise.allSettled(
      posts.map((p) =>
        enqueueJob({
          kind: JobKind.GENERATE_IMAGE,
          payload: { postId: p.id },
          postId: p.id,
          redisUrl,
          siteId: p.siteId,
        }),
      ),
    );
    const rejections = fanoutRejections(results);
    for (const { index, reason } of rejections) {
      log.error({
        err: reason,
        message: "hero-backfill: enqueue failed",
        postId: posts[index]?.id,
        siteId: posts[index]?.siteId,
      });
    }
    const enqueued = results.length - rejections.length;
    log.info({
      enqueued,
      failed: rejections.length,
      message: "hero-backfill: swept",
      scanned: posts.length,
      truncated: posts.length === CAP,
    });
    return { enqueued };
  };

export const backfillHeroes = makeBackfillHeroes({
  enqueueJob: enqueue,
  findHeroless: defaultFindHeroless,
});
