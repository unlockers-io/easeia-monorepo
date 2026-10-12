import { prisma, type SiteLanguage } from "@repo/db";
import { generatePostImage as realGeneratePostImage, buildBodyImagePrompt } from "@repo/hero";
import type { ConsumerContext } from "@repo/jobs";
import { applyBodyImages, type BodyImage, reviseBody as realReviseBody } from "@repo/posts";
import { planBodyImages as realPlanBodyImages } from "@repo/rewrite";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";

type PostForBodyImages = {
  body: string;
  id: string;
  site: { imageStyle: string | null; language: SiteLanguage };
  siteId: string;
  slug: string;
  tags: ReadonlyArray<string>;
  title: string;
};

type UpsertBodyImageInput = {
  alt: string;
  blobKey: string;
  blobUrl: string;
  filename: string;
  height: number;
  postId: string;
  width: number;
};

type Deps = {
  enabled?: boolean;
  findPost?: (postId: string) => Promise<PostForBodyImages | null>;
  generatePostImage?: typeof realGeneratePostImage;
  planBodyImages?: typeof realPlanBodyImages;
  reviseBody?: typeof realReviseBody;
  upsertImage?: (input: UpsertBodyImageInput) => Promise<void>;
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

const defaultUpsertImage = async (input: UpsertBodyImageInput): Promise<void> => {
  await prisma.postImage.upsert({
    create: { ...input, isHero: false, mime: "image/jpeg" },
    update: {
      alt: input.alt,
      blobKey: input.blobKey,
      blobUrl: input.blobUrl,
      height: input.height,
      width: input.width,
    },
    where: { postId_filename: { filename: input.filename, postId: input.postId } },
  });
};

export const makeHandleGenerateBodyImages =
  (deps: Deps = {}) =>
  async (ctx: ConsumerContext<"GENERATE_BODY_IMAGES">): Promise<void> => {
    const { jobId, payload } = ctx;
    const { postId } = payload;
    const enabled = deps.enabled ?? env.BODY_IMAGES_ENABLED;
    const findPost = deps.findPost ?? defaultFindPost;
    const planBodyImages = deps.planBodyImages ?? realPlanBodyImages;
    const generatePostImage = deps.generatePostImage ?? realGeneratePostImage;
    const upsertImage = deps.upsertImage ?? defaultUpsertImage;
    const reviseBody = deps.reviseBody ?? realReviseBody;
    const log = createJobLogger({ jobId, queue: "generate-body-images" });
    log.set({ postId });

    if (!enabled) {
      log.info("generate-body-images: disabled by BODY_IMAGES_ENABLED, skip");
      log.emit();
      return;
    }

    const post = await findPost(postId);
    if (!post) {
      log.warn("generate-body-images: post not found; skipping");
      log.emit();
      return;
    }
    // Also covers externally-authored posts that shipped their own images, and
    // makes a retry after a partial run a no-op instead of a second set.
    if (MARKDOWN_IMAGE.test(post.body)) {
      log.info("generate-body-images: body already has images; skipping");
      log.emit();
      return;
    }

    const plan = await planBodyImages({
      body: post.body,
      post: { tags: post.tags, title: post.title },
      site: { language: post.site.language },
    });
    if (plan.length === 0) {
      log.info("generate-body-images: planner found no spots; skipping");
      log.emit();
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
      await upsertImage({
        alt: planned.alt,
        blobKey: image.key,
        blobUrl: image.url,
        filename,
        height: image.height,
        postId: post.id,
        width: image.width,
      });
      inserted.push({ alt: planned.alt, line: planned.line, url: image.url });
    }

    await reviseBody(post.id, { body: applyBodyImages(post.body, inserted), from: post.body });
    log.set({ insertedImages: inserted.length });
    log.info("generate-body-images: done");
    log.emit();
  };

export const handleGenerateBodyImages = makeHandleGenerateBodyImages();
