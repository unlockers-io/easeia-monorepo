import type { ConsumerContext } from "@repo/jobs";
import { suggestForPost } from "@repo/suggest-links";

import { createJobLogger } from "../lib/logger";

export const handleSuggestLinks = async (ctx: ConsumerContext<"SUGGEST_LINKS">): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "suggest-links" });
  const summary = await suggestForPost(payload.postId);
  log.set({ postId: payload.postId, ...summary });
  log.info("suggest-links: done");
  log.emit();
};
