import { JobKind } from "@repo/db";
import { enqueue, type ConsumerContext } from "@repo/jobs";
import { rewritePost } from "@repo/rewrite";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";

export const handleRewritePost = async (ctx: ConsumerContext<"REWRITE_POST">): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "rewrite-post" });
  const result = await rewritePost(payload.postId, { force: payload.force });
  log.set({ postId: payload.postId, ...result });
  log.info("rewrite-post: done");
  log.emit();

  if (result.outcome !== "rewritten") {
    return;
  }

  // The rewritten body's anchors only enter the link graph through this crawl,
  // so a dropped enqueue leaves them invisible. Rethrown, not swallowed: BullMQ
  // retries the job and the rewrite itself is idempotent under `force`.
  await enqueue({
    kind: JobKind.CRAWL_LINKS,
    payload: { postId: payload.postId },
    postId: payload.postId,
    redisUrl: env.REDIS_URL,
  });
};
