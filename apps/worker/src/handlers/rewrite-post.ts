import { rewritePost } from "@repo/rewrite";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

export const handleRewritePost = async ({
  log,
  payload,
}: JobContext<"REWRITE_POST">): Promise<void> => {
  const result = await rewritePost(prisma, payload.postId, { force: payload.force });
  log.set({ postId: payload.postId, ...result });
  log.info("rewrite-post: done");
};
