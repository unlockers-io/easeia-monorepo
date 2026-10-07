import { prisma } from "@repo/db";
import { generateHero as realGenerateHero } from "@repo/hero";
import type { ConsumerContext } from "@repo/jobs";
import { requestRedeploy as realRequestRedeploy } from "@repo/sites";

import { createJobLogger } from "../lib/logger";

type PostForHero = {
  categories: ReadonlyArray<string>;
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
  hasHero?: (postId: string) => Promise<boolean>;
  requestRedeploy?: typeof realRequestRedeploy;
};

const defaultFindPost = (postId: string): Promise<PostForHero | null> =>
  prisma.post.findUnique({
    select: {
      categories: true,
      id: true,
      site: { select: { imageStyle: true } },
      siteId: true,
      slug: true,
      tags: true,
      title: true,
    },
    where: { id: postId },
  });

const defaultHasHero = async (postId: string): Promise<boolean> =>
  (await prisma.postImage.findFirst({ select: { id: true }, where: { isHero: true, postId } })) !==
  null;

export const makeHandleGenerateImage =
  (deps: Deps = {}) =>
  async (ctx: ConsumerContext<"GENERATE_IMAGE">): Promise<void> => {
    const { jobId, payload } = ctx;
    const { postId } = payload;
    const findPost = deps.findPost ?? defaultFindPost;
    const hasHero = deps.hasHero ?? defaultHasHero;
    const generateHero = deps.generateHero ?? realGenerateHero;
    const requestRedeploy = deps.requestRedeploy ?? realRequestRedeploy;
    const log = createJobLogger({ jobId, queue: "generate-image" });
    log.set({ postId });

    log.info("generate-image: start");

    const post = await findPost(postId);
    if (!post) {
      log.warn("generate-image: post not found; skipping");
      log.emit();
      return;
    }
    if (await hasHero(postId)) {
      log.info("generate-image: hero already exists; skipping");
      log.emit();
      return;
    }
    await generateHero({
      post: {
        categories: post.categories,
        id: post.id,
        siteId: post.siteId,
        slug: post.slug,
        tags: post.tags,
        title: post.title,
      },
      site: post.site,
    });
    await requestRedeploy(post.siteId);
    log.info("generate-image: done");
    log.emit();
  };

export const handleGenerateImage = makeHandleGenerateImage();
