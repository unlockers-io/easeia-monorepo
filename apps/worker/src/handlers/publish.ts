import type { ConsumerContext } from "@repo/jobs";
import { pruneFabricatedLinks } from "@repo/links";
import * as Posts from "@repo/posts";

import { ensureHero } from "../lib/ensure-hero";
import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";

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
    await Posts.completePublish(postId, { bodyImages: env.BODY_IMAGES_ENABLED });

    log.info("publish: done");
    log.emit();
  } catch (error) {
    if (ctx.finalAttempt) {
      try {
        await Posts.failPublish(postId);
      } catch (failError) {
        log.error(failError instanceof Error ? failError : String(failError), {
          failPublishFailed: true,
        });
      }
    }
    log.error(error instanceof Error ? error : "publish: failed");
    log.emit();
    throw error;
  }
};
