import { resolveCategory } from "@repo/classify";
import { JobKind, prisma } from "@repo/db";
import { asLoggableError, enqueue, fanoutRejections, type ConsumerContext } from "@repo/jobs";
import { pruneFabricatedLinks } from "@repo/links";
import * as Posts from "@repo/posts";
import { parseDeployHook } from "@repo/sites";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";
import { publishToAstro } from "../lib/publish-to-astro";

export const handlePublish = async (ctx: ConsumerContext<"PUBLISH">): Promise<void> => {
  const { jobId, payload } = ctx;
  const { postId } = payload;
  const log = createJobLogger({ jobId, queue: "publish" });
  log.set({ postId });
  log.info("publish: start");

  try {
    const post = await prisma.post.findUniqueOrThrow({
      include: { site: { select: { imageStyle: true, vercelDeployHookUrl: true } } },
      where: { id: postId },
    });

    // Same predicate the deploy job uses, so a Post cannot reach PUBLISHED via a
    // hook the deploy step will later refuse to POST.
    if (parseDeployHook(post.site.vercelDeployHookUrl) === null) {
      throw new Error(
        `Site ${post.siteId} has no usable vercelDeployHookUrl; cannot publish via Astro pipeline`,
      );
    }

    let categories = post.categories;
    if (categories.length === 0) {
      const resolved = await resolveCategory(post.siteId, post.niches);
      await prisma.post.update({ data: { categories: [resolved] }, where: { id: post.id } });
      categories = [resolved];
      log.set({ resolvedCategory: resolved });
      log.info("publish: assigned fallback category to uncategorized post");
    }

    const { stripped } = await pruneFabricatedLinks(post.id);
    if (stripped.length > 0) {
      log.set({ strippedFabricatedLinks: stripped.length });
      log.info("publish: stripped fabricated internal links");
    }

    await publishToAstro({
      autogenEnabled: env.HERO_AUTOGEN_ENABLED,
      post: {
        categories,
        featuredImage: post.featuredImage,
        id: post.id,
        siteId: post.siteId,
        slug: post.slug,
        tags: post.tags,
        title: post.title,
      },
      redisUrl: env.REDIS_URL,
      site: post.site,
    });

    await Posts.recordPublishedAstro({ postId });

    const fanoutKinds = env.BODY_IMAGES_ENABLED
      ? [JobKind.CRAWL_LINKS, JobKind.EMBED, JobKind.GENERATE_BODY_IMAGES]
      : [JobKind.CRAWL_LINKS, JobKind.EMBED];
    const fanout = await Promise.allSettled(
      fanoutKinds.map((kind) =>
        enqueue({
          kind,
          payload: { postId },
          postId,
          redisUrl: env.REDIS_URL,
        }),
      ),
    );
    for (const { index, reason } of fanoutRejections(fanout)) {
      log.error(asLoggableError(reason), { fanoutKind: fanoutKinds[index] });
    }

    log.info("publish: done");
    log.emit();
  } catch (error) {
    if (ctx.finalAttempt) {
      try {
        await Posts.recordPublishFailure(postId);
      } catch (recordError) {
        log.error(recordError instanceof Error ? recordError : String(recordError), {
          recordPublishFailureFailed: true,
        });
      }
    }
    log.error(error instanceof Error ? error : "publish: failed");
    log.emit();
    throw error;
  }
};
