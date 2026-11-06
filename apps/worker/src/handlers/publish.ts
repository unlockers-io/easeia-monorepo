import type { ConsumerContext } from "@repo/jobs";
import { pruneFabricatedLinks } from "@repo/links";
import { createJobLogger } from "@repo/observability/worker";
import * as Posts from "@repo/posts";

import { ensureHero } from "../lib/ensure-hero";
import { env } from "../lib/env";

export const handlePublish = async (ctx: ConsumerContext<"PUBLISH">): Promise<void> => {
  const { jobId, payload } = ctx;
  const { postId } = payload;
  const log = createJobLogger({ jobId, queue: "publish" });
  log.set({ postId });
  log.info("publish: start");

  try {
    const target = await Posts.startPublish(postId);

    if (target === null) {
      log.info("publish: post no longer awaits publishing, skip");
      log.emit();

      return;
    }

    const { stripped } = await pruneFabricatedLinks(postId);

    if (stripped.length > 0) {
      log.set({ strippedFabricatedLinks: stripped.length });
      log.info("publish: stripped fabricated internal links");
    }

    await ensureHero({ autogenEnabled: env.HERO_AUTOGEN_ENABLED, ...target });
    await Posts.completePublish(postId);

    log.info("publish: done");
    log.emit();
  } catch (error) {
    log.error(error instanceof Error ? error : "publish: failed");
    log.emit();
    throw error;
  }
};

export const failPublish = ({ payload }: ConsumerContext<"PUBLISH">): Promise<void> =>
  Posts.failPublish(payload.postId);
