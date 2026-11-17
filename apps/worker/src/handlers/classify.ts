import { classifyPost } from "@repo/classify";

import { prisma } from "../lib/db";
import type { JobContext } from "../lib/job-log";

export const handleClassify = async ({ log, payload }: JobContext<"CLASSIFY">): Promise<void> => {
  log.set({ postId: payload.postId });
  await classifyPost(prisma, payload.postId);
  log.info("classify: done");
};
