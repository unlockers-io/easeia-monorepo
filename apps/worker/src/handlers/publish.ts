import type { ConsumerContext } from "@repo/jobs";
import { pruneFabricatedLinks } from "@repo/links";
import * as Posts from "@repo/posts";

import { ensureHero } from "../lib/ensure-hero";
import { env } from "../lib/env";
import type { JobContext } from "../lib/job-log";

export const handlePublish = async ({ log, payload }: JobContext<"PUBLISH">): Promise<void> => {
  const { postId } = payload;
  log.set({ postId });
  log.info("publish: start");

  const target = await Posts.startPublish(postId);

  if (target === null) {
    log.info("publish: post no longer awaits publishing, skip");

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
};

export const failPublish = ({ payload }: ConsumerContext<"PUBLISH">): Promise<void> =>
  Posts.failPublish(payload.postId);
