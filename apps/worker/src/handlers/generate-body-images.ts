import { prisma, type SiteLanguage } from "@repo/db";
import { generatePostImage as realGeneratePostImage, buildBodyImagePrompt } from "@repo/hero";
import { JobSkippedError } from "@repo/jobs";
import { type BodyImage, illustrate as realIllustrate } from "@repo/posts";
import { planBodyImages as realPlanBodyImages } from "@repo/rewrite";

import { env } from "../lib/env";
import type { JobContext } from "../lib/job-log";

type PostForBodyImages = {
  body: string;
  id: string;
  site: { imageStyle: string | null; language: SiteLanguage };
  siteId: string;
  slug: string;
  tags: ReadonlyArray<string>;
  title: string;
};

type Deps = {
  enabled?: boolean;
  findPost?: (postId: string) => Promise<PostForBodyImages | null>;
  generatePostImage?: typeof realGeneratePostImage;
  illustrate?: typeof realIllustrate;
  planBodyImages?: typeof realPlanBodyImages;
};

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(/v;

const defaultFindPost = (postId: string): Promise<PostForBodyImages | null> =>
  prisma.post.findUnique({
    select: {
      body: true,
      id: true,
      site: { select: { imageStyle: true, language: true } },
      siteId: true,
      slug: true,
      tags: true,
      title: true,
    },
    where: { id: postId },
  });

export const makeHandleGenerateBodyImages =
  (deps: Deps = {}) =>
  async ({ log, payload }: JobContext<"GENERATE_BODY_IMAGES">): Promise<void> => {
    const { postId } = payload;
    const enabled = deps.enabled ?? env.BODY_IMAGES_ENABLED;
    const findPost = deps.findPost ?? defaultFindPost;
    const planBodyImages = deps.planBodyImages ?? realPlanBodyImages;
    const generatePostImage = deps.generatePostImage ?? realGeneratePostImage;
    const illustrate = deps.illustrate ?? realIllustrate;
    log.set({ postId });

    if (!enabled) {
      log.info("generate-body-images: disabled by BODY_IMAGES_ENABLED, skip");

      return;
    }

    const post = await findPost(postId);

    if (!post) {
      throw new JobSkippedError("Post no longer exists");
    }

    // Also covers externally-authored posts that shipped their own images, and
    // makes a retry after a partial run a no-op instead of a second set.
    if (MARKDOWN_IMAGE.test(post.body)) {
      log.info("generate-body-images: body already has images; skipping");

      return;
    }

    const plan = await planBodyImages({
      body: post.body,
      post: { tags: post.tags, title: post.title },
      site: { language: post.site.language },
    });

    if (plan.length === 0) {
      log.info("generate-body-images: planner found no spots; skipping");

      return;
    }

    log.set({ plannedImages: plan.length });

    const inserted: Array<BodyImage> = [];

    for (const [i, planned] of plan.entries()) {
      const filename = `${post.slug}-${i + 1}.jpg`;

      // Serial on purpose: parallel image calls trip OpenAI's rate limit long
      // before they save meaningful wall-clock on a 2-4 image post.
      const image = await generatePostImage({
        filename,
        post: { id: post.id, siteId: post.siteId },
        prompt: buildBodyImagePrompt({
          index: i + 1,
          slug: post.slug,
          style: post.site.imageStyle,
          subject: planned.prompt,
        }),
      });

      inserted.push({
        alt: planned.alt,
        blobKey: image.key,
        blobUrl: image.url,
        filename,
        height: image.height,
        line: planned.line,
        mime: image.mime,
        width: image.width,
      });
    }

    await illustrate(post.id, { from: post.body, images: inserted });
    log.set({ insertedImages: inserted.length });
    log.info("generate-body-images: done");
  };

export const handleGenerateBodyImages = makeHandleGenerateBodyImages();
