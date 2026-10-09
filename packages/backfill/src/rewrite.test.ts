import { JobKind, PostStatus, prisma } from "@repo/db";
import { closeJobs, countJobs } from "@repo/jobs";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { rewriteBackfill } from "./index";

const rewrites = (postId: string) => countJobs({ kinds: [JobKind.REWRITE_POST], postId });

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "rewriteBackfill on Postgres and Redis",
  () => {
    const run = `rewrite-${Date.now()}`;
    const startedAt = new Date();
    const siteIds: Array<string> = [];

    const livePost = async (name: string, vercelDeployHookUrl: string | null) => {
      const site = await prisma.site.create({
        data: { domain: `${name}.${run}.test`, vercelDeployHookUrl },
      });
      siteIds.push(site.id);
      return prisma.post.create({
        data: {
          body: "<p>Body.</p>",
          publishedAt: new Date(),
          siteId: site.id,
          slug: name,
          status: PostStatus.PUBLISHED,
          title: name,
        },
      });
    };

    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    afterAll(async () => {
      await prisma.job.deleteMany({
        where: {
          OR: [
            { post: { siteId: { in: siteIds } } },
            { createdAt: { gte: startedAt }, kind: JobKind.BACKFILL_REWRITE },
          ],
        },
      });
      await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
      await closeJobs();
    });

    it("requests a rewrite for each post on a publishable Site only", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      const publishable = await livePost("publishable", "https://deploy.test/hook");
      const hookless = await livePost("hookless", null);

      await rewriteBackfill.tick({
        attemptsMade: 0,
        finalAttempt: false,
        jobId: `tick-${run}`,
        payload: {
          force: true,
          initialPostsEligible: 1,
          phase: "REWRITE_POST",
          startedAt: startedAt.toISOString(),
        },
      });

      expect(await rewrites(publishable.id)).toBe(1);
      expect(await rewrites(hookless.id)).toBe(0);
    });
  },
);
