import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5440/easeia_test",
    HERO_AUTOGEN_ENABLED: "false",
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-key",
  });
});

import { JobKind, PostStatus, prisma } from "@repo/db";
import { closeJobs, countJobs, listJobs } from "@repo/jobs";
import * as Posts from "@repo/posts";

import { handlePublish } from "./publish";

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "handlePublish",
  () => {
    const run = `publish-${Date.now().toString(36)}`;
    const siteIds: Array<string> = [];

    afterAll(async () => {
      await prisma.job.deleteMany({
        where: { OR: [{ siteId: { in: siteIds } }, { post: { siteId: { in: siteIds } } }] },
      });
      await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
      await closeJobs();
    });

    it("publishes the post before its Site deploy is requested", async () => {
      const site = await prisma.site.create({
        data: { domain: `${run}.test`, vercelDeployHookUrl: "https://deploy.test/hook" },
      });
      siteIds.push(site.id);
      const { job, post } = await Posts.create({
        body: "<p>Body.</p>",
        categories: ["Casamentos"],
        publish: true,
        siteId: site.id,
        slug: "first-post",
        title: "First post",
      });

      await handlePublish({
        attemptsMade: 0,
        finalAttempt: false,
        jobId: job?.id ?? "",
        payload: { postId: post.id },
      });

      const published = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
      const { data: deploys } = await listJobs({
        kinds: [JobKind.TRIGGER_DEPLOY],
        limit: 1,
        siteId: site.id,
      });
      const [deploy] = deploys;
      expect(published.status).toBe(PostStatus.PUBLISHED);
      expect(deploy?.createdAt.getTime()).toBeGreaterThanOrEqual(
        published.publishedAt?.getTime() ?? Number.POSITIVE_INFINITY,
      );
      expect(await countJobs({ kinds: [JobKind.EMBED], postId: post.id })).toBe(1);
      expect(await countJobs({ kinds: [JobKind.CRAWL_LINKS], postId: post.id })).toBe(1);
    });
  },
);
