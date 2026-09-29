import { AiNotConfiguredError } from "@repo/ai";
import { type PostStatus, prisma, type SiteLanguage } from "@repo/db";
import { generatePostImage as realGeneratePostImage, buildBodyImagePrompt } from "@repo/hero";
import { enqueueTriggerDeploy as realEnqueueTriggerDeploy, type ConsumerContext } from "@repo/jobs";
import { applyBodyImages, type BodyImage } from "@repo/posts";
import { planBodyImages as realPlanBodyImages } from "@repo/rewrite";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";

type PostForBodyImages = {
  body: string;
  id: string;
  site: { imageStyle: string | null; language: SiteLanguage };
  siteId: string;
  slug: string;
  status: PostStatus;
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
  enqueueTriggerDeploy?: typeof realEnqueueTriggerDeploy;
  findPost?: (postId: string) => Promise<PostForBodyImages | null>;
  generatePostImage?: typeof realGeneratePostImage;
  planBodyImages?: typeof realPlanBodyImages;
  readBody?: (postId: string) => Promise<string | null>;
  redisUrl?: string;
  upsertImage?: (input: UpsertBodyImageInput) => Promise<void>;
  writeBody?: (input: { body: string; postId: string }) => Promise<void>;
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
      status: true,
      tags: true,
      title: true,
    },
    where: { id: postId },
  });

const defaultReadBody = async (postId: string): Promise<string | null> => {
  const row = await prisma.post.findUnique({ select: { body: true }, where: { id: postId } });
  return row?.body ?? null;
};

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

const defaultWriteBody = async (input: { body: string; postId: string }): Promise<void> => {
  await prisma.post.update({ data: { body: input.body }, where: { id: input.postId } });
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
    const readBody = deps.readBody ?? defaultReadBody;
    const writeBody = deps.writeBody ?? defaultWriteBody;
    const enqueueTriggerDeploy = deps.enqueueTriggerDeploy ?? realEnqueueTriggerDeploy;
    const redisUrl = deps.redisUrl ?? env.REDIS_URL;
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

    let inserted: ReadonlyArray<BodyImage>;
    try {
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

      const images: Array<BodyImage> = [];
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
        images.push({ alt: planned.alt, line: planned.line, url: image.url });
      }
      inserted = images;
    } catch (error) {
      // Parity with the hero job: an unconfigured worker skips rather than
      // burning the whole retry ladder on a condition retrying cannot fix.
      if (error instanceof AiNotConfiguredError) {
        log.warn("generate-body-images: OPENAI_API_KEY not set, skip");
        log.emit();
        return;
      }
      throw error;
    }

    // The plan's line numbers only mean anything against the body they were
    // planned from. Retrying is the right answer to a concurrent edit; splicing
    // into shifted lines would scatter the images through unrelated prose.
    const fresh = await readBody(post.id);
    if (fresh !== post.body) {
      throw new Error(
        `Post ${post.id} body changed while its images were generating; retrying against the new body`,
      );
    }

    await writeBody({ body: applyBodyImages(post.body, inserted), postId: post.id });
    // A draft has nothing live to rebuild; the publish-time deploy ships it.
    if (post.status === "PUBLISHED") {
      await enqueueTriggerDeploy({ redisUrl, siteId: post.siteId });
    }
    log.set({ insertedImages: inserted.length });
    log.info("generate-body-images: done");
    log.emit();
  };

export const handleGenerateBodyImages = makeHandleGenerateBodyImages();
