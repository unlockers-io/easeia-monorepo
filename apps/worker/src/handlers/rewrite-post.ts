import type { ConsumerContext } from "@repo/jobs";
import * as Posts from "@repo/posts";
import { rewritePost } from "@repo/rewrite";

import { createJobLogger } from "../lib/logger";

export const handleRewritePost = async (ctx: ConsumerContext<"REWRITE_POST">): Promise<void> => {
  const { attemptsMade, jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "rewrite-post" });
  const result = await rewritePost(payload.postId, { force: payload.force });
  log.set({ postId: payload.postId, ...result });

  const mayHaveRewritten = result.outcome === "rewritten" || attemptsMade > 0;
  if (mayHaveRewritten) {
    await Posts.completeRewrite(payload.postId);
  }
  log.info("rewrite-post: done");
  log.emit();
};
