import { createFakeOpenAi } from "@repo/ai/testing";
import { JobKind, prisma } from "@repo/db";
import { countJobs } from "@repo/jobs";
import { afterEach, describe, expect, it } from "vitest";

import { generateHero } from "./index";

describe.runIf(process.env.TEST_DATABASE === "true")("durable hero completion", () => {
  let siteId = "";
  afterEach(async () => {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS thermo_fail_hero ON "Job"');
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS thermo_fail_hero()");
    await prisma.job.deleteMany({ where: { siteId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
  });
  it("commits the image, featured URL, and rebuild intent together", async () => {
    const site = await prisma.site.create({
      data: {
        domain: `hero-${crypto.randomUUID()}.test`,
        vercelDeployHookUrl: "https://deploy.test/hook",
      },
    });
    siteId = site.id;
    const post = await prisma.post.create({
      data: { body: "Body", siteId, slug: "post", status: "PUBLISHED", title: "Post" },
    });
    const fake = createFakeOpenAi();
    const deps = {
      blob: {
        upload: () => Promise.resolve({ key: "image.jpg", url: "https://cdn.test/image.jpg" }),
      },
      generateImage: fake.ai.generateImage,
    };
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION thermo_fail_hero() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."siteId" = '${siteId}' THEN RAISE EXCEPTION 'injected hero intent failure'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER thermo_fail_hero BEFORE INSERT ON "Job" FOR EACH ROW EXECUTE FUNCTION thermo_fail_hero()',
    );
    await expect(generateHero({ post, site }, deps)).rejects.toThrow(
      "injected hero intent failure",
    );
    expect(await prisma.postImage.count({ where: { postId: post.id } })).toBe(0);
    const unchanged = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(unchanged.featuredImage).toBeNull();
    await prisma.$executeRawUnsafe('DROP TRIGGER thermo_fail_hero ON "Job"');
    await generateHero({ post, site }, deps);
    expect(await prisma.postImage.count({ where: { postId: post.id } })).toBe(1);
    expect(await countJobs({ kinds: [JobKind.TRIGGER_DEPLOY], siteId })).toBe(1);
  });
});
