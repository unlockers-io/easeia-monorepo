import { AiNotConfiguredError } from "@repo/ai";
import { classifyPost } from "@repo/classify";
import type { ConsumerContext } from "@repo/jobs";

import { createJobLogger } from "../lib/logger";

export const handleClassify = async (ctx: ConsumerContext<"CLASSIFY">): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "classify" });
  log.set({ postId: payload.postId });
  try {
    await classifyPost(payload.postId);
  } catch (error) {
    // Skipping is the job's decision, not the package's. Without this branch an
    // unconfigured worker would retry every CLASSIFY job to exhaustion; with the
    // old null return it logged "done" for a job that classified nothing.
    if (error instanceof AiNotConfiguredError) {
      log.warn("classify: OPENAI_API_KEY not set, skip");
      log.emit();
      return;
    }
    throw error;
  }
  log.info("classify: done");
  log.emit();
};
