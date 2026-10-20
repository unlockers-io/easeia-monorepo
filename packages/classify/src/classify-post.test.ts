import { JobKind, prisma } from "@repo/db";
import { countJobs } from "@repo/jobs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyPost, type classifyContent } from "./classify";

describe.runIf(process.env.TEST_DATABASE === "true")("classification intake", () => {
  let siteId = "";
  afterEach(async () => {
    await prisma.job.deleteMany({ where: { siteId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
  });
  it.each(["DRAFT", "PUBLISHED"] as const)(
    "preserves normalized tags and owns %s consequences",
    async (status) => {
      const site = await prisma.site.create({
        data: {
          domain: `classify-${crypto.randomUUID()}.test`,
          vercelDeployHookUrl: "https://deploy.test/hook",
        },
      });
      siteId = site.id;
      const post = await prisma.post.create({
        data: { body: "Body", siteId, slug: "post", status, tags: ["Existing"], title: "Post" },
      });
      const classify = vi
        .fn<typeof classifyContent>()
        .mockResolvedValue({ niches: ["AUDIO"], tags: ["studio", "microphone", "recording"] });
      await classifyPost(post.id, classify);
      await classifyPost(post.id, classify);
      expect(await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({
        niches: ["AUDIO"],
        tags: ["existing", "studio", "microphone", "recording"],
      });
      expect(await countJobs({ kinds: [JobKind.TRIGGER_DEPLOY], siteId })).toBe(
        status === "PUBLISHED" ? 1 : 0,
      );
      expect(await countJobs({ kinds: [JobKind.EMBED], postId: post.id })).toBe(0);
    },
  );
});
