import * as Blob from "@repo/blob";
import { generateHero as defaultGenerateHero } from "@repo/hero";
import { log } from "@repo/observability";
import * as Posts from "@repo/posts";

import { type HeroRow, planHero } from "./hero-plan";

/**
 * Every collaborator is required. Resolving them with `??` against a default
 * made the production wiring invisible: a caller that forgot one, or a test
 * that misspelled a field, silently ran the real Prisma/R2/OpenAI path.
 */
export type EnsureHeroDeps = {
  blob: Pick<typeof Blob, "upload">;
  fetchImage: (url: string) => Promise<Uint8Array>;
  generateHero: typeof defaultGenerateHero;
  heroOf: (postId: string) => Promise<HeroRow | null>;
  isBlobUrl: (url: string) => boolean;
  setHero: typeof Posts.setHero;
};

type EnsureHeroInput = {
  autogenEnabled: boolean;
  post: {
    featuredImage: string | null;
    id: string;
    siteId: string;
    slug: string;
    tags: ReadonlyArray<string>;
    title: string;
  };
  site: { imageStyle: string | null };
};

const defaultFetchImage = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });

  if (!res.ok) {
    throw new Error(`fetch ${url}: ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
};

export const makeEnsureHero =
  (deps: EnsureHeroDeps) =>
  async (input: EnsureHeroInput): Promise<void> => {
    const plan = planHero({
      autogenEnabled: input.autogenEnabled,
      featuredImage: input.post.featuredImage,
      hero: await deps.heroOf(input.post.id),
      isBlobUrl: deps.isBlobUrl,
    });

    if (plan.kind === "import") {
      const mime = Blob.mimeFor(plan.filename);
      const bytes = await deps.fetchImage(plan.sourceUrl);

      const result = await deps.blob.upload({
        bytes,
        filename: plan.filename,
        mime,
        postId: input.post.id,
        siteId: input.post.siteId,
      });

      await deps.setHero(input.post.id, {
        blobKey: result.key,
        blobUrl: result.url,
        filename: plan.filename,
        height: null,
        mime,
        width: null,
      });
    } else if (plan.kind === "generate") {
      try {
        await deps.generateHero({ post: input.post, site: input.site });
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
  };

export const ensureHero = makeEnsureHero({
  blob: Blob,
  fetchImage: defaultFetchImage,
  generateHero: defaultGenerateHero,
  heroOf: Posts.heroOf,
  isBlobUrl: (url) => Blob.isBlobUrl(url),
  setHero: Posts.setHero,
});
