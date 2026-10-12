import type { ConsumerContext } from "@repo/jobs";
import { rewritePost } from "@repo/rewrite";

import { createJobLogger } from "../lib/logger";

export const handleRewritePost = async (ctx: ConsumerContext<"REWRITE_POST">): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "rewrite-post" });
  const result = await rewritePost(payload.postId, { force: payload.force });
  log.set({ postId: payload.postId, ...result });
  log.info("rewrite-post: done");
  log.emit();
};
