import { JobKind, PostStatus, prisma } from "@repo/db";
import { countJobs } from "@repo/jobs";
import { afterAll, describe, expect, it } from "vitest";

import { handleBackfillHeroes } from "./backfill-heroes";

describe.runIf(process.env.TEST_DATABASE === "true")("handleBackfillHeroes", () => {
  let siteId = "";

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { siteId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
  });

  it("enqueues one GENERATE_IMAGE per published post without a hero", async () => {
    const site = await prisma.site.create({
      data: { domain: `heroes-${crypto.randomUUID()}.test` },
    });

    siteId = site.id;

    const post = (slug: string, status: PostStatus) =>
      prisma.post.create({ data: { body: "b", siteId, slug, status, title: slug } });

    const [heroless, withHero] = await Promise.all([
      post("heroless", PostStatus.PUBLISHED),
      post("with-hero", PostStatus.PUBLISHED),
      post("draft", PostStatus.DRAFT),
    ]);

    await prisma.postImage.create({
      data: {
        blobKey: "k",
        blobUrl: "https://blob.test/k.jpg",
        filename: "with-hero.jpg",
        isHero: true,
        mime: "image/jpeg",
        postId: withHero.id,
      },
    });

    await handleBackfillHeroes();

    expect(await countJobs({ kinds: [JobKind.GENERATE_IMAGE], postId: heroless.id })).toBe(1);
    expect(await countJobs({ kinds: [JobKind.GENERATE_IMAGE], siteId })).toBe(1);
  });
});
