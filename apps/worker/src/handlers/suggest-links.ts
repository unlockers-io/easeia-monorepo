import { suggestForPost } from "@repo/links";

import type { JobContext } from "../lib/job-log";

export const handleSuggestLinks = async ({
  log,
  payload,
}: JobContext<"SUGGEST_LINKS">): Promise<void> => {
  const summary = await suggestForPost(payload.postId);
  log.set({ postId: payload.postId, ...summary });
  log.info("suggest-links: done");
};
