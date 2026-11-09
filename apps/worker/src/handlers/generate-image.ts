import { prisma } from "@repo/db";
import { generateHero as realGenerateHero } from "@repo/hero";
import type { ConsumerContext } from "@repo/jobs";
import { createJobLogger } from "@repo/observability/worker";
import * as Posts from "@repo/posts";

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
  async (ctx: ConsumerContext<"GENERATE_IMAGE">): Promise<void> => {
    const { jobId, payload } = ctx;
    const { postId } = payload;
    const findPost = deps.findPost ?? defaultFindPost;
    const heroOf = deps.heroOf ?? Posts.heroOf;
    const generateHero = deps.generateHero ?? realGenerateHero;
    const log = createJobLogger({ jobId, queue: "generate-image" });
    log.set({ postId });

    log.info("generate-image: start");

    const post = await findPost(postId);

    if (!post) {
      log.warn("generate-image: post not found; skipping");
      log.emit();

      return;
    }

    if ((await heroOf(postId)) !== null) {
      log.info("generate-image: hero already exists; skipping");
      log.emit();

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
    log.emit();
  };

export const handleGenerateImage = makeHandleGenerateImage();
