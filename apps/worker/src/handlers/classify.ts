import { classifyPost } from "@repo/classify";
import type { ConsumerContext } from "@repo/jobs";

import { createJobLogger } from "../lib/logger";

export const handleClassify = async (ctx: ConsumerContext<"CLASSIFY">): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "classify" });
  log.set({ postId: payload.postId });
  await classifyPost(payload.postId);
  log.info("classify: done");
  log.emit();
};
