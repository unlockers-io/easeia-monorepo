import { prisma } from "@repo/db";
import { generateHero as realGenerateHero } from "@repo/hero";
import * as Posts from "@repo/posts";

import type { JobContext } from "../lib/job-log";

type PostForHero = {
  id: string;
  site: { imageStyle: string | null };
  siteId: string;
  slug: string;
  tags: ReadonlyArray<string>;
  title: string;
};

type Deps = {
  findPost?: (postId: string) => Promise<PostForHero | null>;
  generateHero?: typeof realGenerateHero;
  heroOf?: typeof Posts.heroOf;
};

const defaultFindPost = (postId: string): Promise<PostForHero | null> =>
  prisma.post.findUnique({
    select: {
      id: true,
      site: { select: { imageStyle: true } },
      siteId: true,
      slug: true,
      tags: true,
      title: true,
    },
    where: { id: postId },
  });

export const makeHandleGenerateImage =
  (deps: Deps = {}) =>
  async ({ log, payload }: JobContext<"GENERATE_IMAGE">): Promise<void> => {
    const { postId } = payload;
    const findPost = deps.findPost ?? defaultFindPost;
    const heroOf = deps.heroOf ?? Posts.heroOf;
    const generateHero = deps.generateHero ?? realGenerateHero;
    log.set({ postId });

    log.info("generate-image: start");

    const post = await findPost(postId);

    if (!post) {
      log.warn("generate-image: post not found; skipping");

      return;
    }

    if ((await heroOf(postId)) !== null) {
      log.info("generate-image: hero already exists; skipping");

      return;
    }

    await generateHero({
      post: {
        id: post.id,
        siteId: post.siteId,
        slug: post.slug,
        tags: post.tags,
        title: post.title,
      },
      site: post.site,
    });
    log.info("generate-image: done");
  };

export const handleGenerateImage = makeHandleGenerateImage();
