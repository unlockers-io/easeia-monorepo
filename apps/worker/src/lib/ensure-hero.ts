import { generateHero as defaultGenerateHero } from "@repo/hero";
import { log } from "@repo/observability";
import * as Posts from "@repo/posts";

export type EnsureHeroDeps = {
  generateHero: typeof defaultGenerateHero;
  heroOf: typeof Posts.heroOf;
};

type EnsureHeroInput = {
  autogenEnabled: boolean;
  post: {
    id: string;
    siteId: string;
    slug: string;
    tags: ReadonlyArray<string>;
    title: string;
  };
  site: { imageStyle: string | null };
};

export const makeEnsureHero =
  (deps: EnsureHeroDeps) =>
  async ({ autogenEnabled, post, site }: EnsureHeroInput): Promise<void> => {
    if ((await deps.heroOf(post.id)) !== null) {
      return;
    }

    if (!autogenEnabled) {
      log.warn({
        message: "publish: no hero image and autogen disabled; publishing heroless",
        postId: post.id,
      });

      return;
    }

    try {
      await deps.generateHero({ post, site });
    } catch (error) {
      log.warn({
        err: error,
        message: "publish: inline hero generation failed; publishing heroless",
        postId: post.id,
      });
    }
  };

export const ensureHero = makeEnsureHero({
  generateHero: defaultGenerateHero,
  heroOf: Posts.heroOf,
});
