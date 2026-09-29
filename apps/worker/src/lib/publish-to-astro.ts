import * as Blob from "@repo/blob";
import { prisma } from "@repo/db";
import { generateHero as defaultGenerateHero } from "@repo/hero";
import { enqueueTriggerDeploy } from "@repo/jobs";

import { type HeroRow, planHero } from "./hero-plan";
import { log } from "./logger";

type BlobLike = Pick<typeof Blob, "upload">;

type PostImageUpsert = {
  blobKey: string;
  blobUrl: string;
  filename: string;
  isHero: boolean;
  mime: string;
  postId: string;
};

const inferMime = (filename: string): string => {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "png") {
    return "image/png";
  }
  if (ext === "webp") {
    return "image/webp";
  }
  if (ext === "gif") {
    return "image/gif";
  }
  return "image/jpeg";
};

/**
 * Every collaborator is required. Resolving them with `??` against a default
 * made the production wiring invisible: a caller that forgot one, or a test
 * that misspelled a field, silently ran the real Prisma/R2/OpenAI path.
 */
export type PublishToAstroDeps = {
  blob: BlobLike;
  enqueueDeploy: (input: { redisUrl: string; siteId: string }) => Promise<{ skipped: boolean }>;
  fetchImage: (url: string) => Promise<Uint8Array>;
  findHeroImage: (postId: string) => Promise<HeroRow | null>;
  generateHero: typeof defaultGenerateHero;
  r2PublicBaseUrl: string | undefined;
  upsertPostImage: (input: PostImageUpsert) => Promise<void>;
};

type PublishToAstroInput = {
  autogenEnabled?: boolean;
  post: {
    categories: ReadonlyArray<string>;
    featuredImage: string | null;
    id: string;
    siteId: string;
    slug: string;
    tags: ReadonlyArray<string>;
    title: string;
  };
  redisUrl: string;
  // No deploy-hook field: `publish.ts` is the sole caller and has already
  // rejected an unusable hook, so carrying a nullable copy here only fed a
  // branch no production path could reach.
  site: { imageStyle: string | null };
};

const defaultFetchImage = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    throw new Error(`fetch ${url}: ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
};

const defaultUpsertPostImage = async (input: PostImageUpsert) => {
  await prisma.postImage.upsert({
    create: input,
    update: { blobKey: input.blobKey, blobUrl: input.blobUrl, isHero: input.isHero },
    where: { postId_filename: { filename: input.filename, postId: input.postId } },
  });
};

const defaultFindHeroImage = (postId: string): Promise<HeroRow | null> =>
  prisma.postImage.findFirst({
    select: { blobUrl: true, filename: true },
    where: { isHero: true, postId },
  });

export const makePublishToAstro =
  (deps: PublishToAstroDeps) =>
  async (input: PublishToAstroInput): Promise<void> => {
    const plan = planHero({
      autogenEnabled: input.autogenEnabled !== false,
      featuredImage: input.post.featuredImage,
      hero: await deps.findHeroImage(input.post.id),
      r2PublicBaseUrl: deps.r2PublicBaseUrl,
    });

    if (plan.kind === "import") {
      const mime = inferMime(plan.filename);
      const bytes = await deps.fetchImage(plan.sourceUrl);
      const result = await deps.blob.upload({
        bytes,
        filename: plan.filename,
        mime,
        postId: input.post.id,
        siteId: input.post.siteId,
      });
      await deps.upsertPostImage({
        blobKey: result.key,
        blobUrl: result.url,
        filename: plan.filename,
        isHero: true,
        mime,
        postId: input.post.id,
      });
    } else if (plan.kind === "generate") {
      try {
        await deps.generateHero({
          post: {
            categories: input.post.categories,
            id: input.post.id,
            siteId: input.post.siteId,
            slug: input.post.slug,
            tags: input.post.tags,
            title: input.post.title,
          },
          site: input.site,
        });
      } catch (error) {
        log.warn({
          err: error,
          message: "publish: inline hero generation failed; publishing heroless",
          postId: input.post.id,
        });
      }
    } else if (plan.kind === "skip") {
      log.warn({
        message: "publish: no hero image and autogen disabled; publishing heroless",
        postId: input.post.id,
      });
    }

    await deps.enqueueDeploy({ redisUrl: input.redisUrl, siteId: input.post.siteId });
  };

export const publishToAstro = makePublishToAstro({
  blob: Blob,
  enqueueDeploy: (input) => enqueueTriggerDeploy(input),
  fetchImage: defaultFetchImage,
  findHeroImage: defaultFindHeroImage,
  generateHero: defaultGenerateHero,
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  upsertPostImage: defaultUpsertPostImage,
});
