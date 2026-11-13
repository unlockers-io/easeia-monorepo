import { classifyPost } from "@repo/classify";

import type { JobContext } from "../lib/job-log";

export const handleClassify = async ({ log, payload }: JobContext<"CLASSIFY">): Promise<void> => {
  log.set({ postId: payload.postId });
  await classifyPost(payload.postId);
  log.info("classify: done");
};
