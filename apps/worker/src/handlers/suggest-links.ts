import { suggestForPost } from "@repo/links";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

export const handleSuggestLinks = async ({
  log,
  payload,
}: JobContext<"SUGGEST_LINKS">): Promise<void> => {
  const summary = await suggestForPost(prisma, payload.postId);
  log.set({ postId: payload.postId, ...summary });
  log.info("suggest-links: done");
};
