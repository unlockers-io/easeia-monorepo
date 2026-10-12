import * as AutoPublish from "@repo/auto-publish";
import type { ConsumerContext } from "@repo/jobs";

import { createJobLogger } from "../lib/logger";

export const handleAutoPublish = async ({ jobId }: ConsumerContext<"AUTO_PUBLISH">) => {
  const log = createJobLogger({ jobId, queue: "auto-publish" });
  const { published, refills, skipped } = await AutoPublish.tick();
  log.set({
    published,
    refilled: refills.filter((refill) => refill.queued > 0),
    skipped,
  });
  log.info("auto-publish: tick");
  log.emit();
};
