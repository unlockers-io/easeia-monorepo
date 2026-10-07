import { JobKind, JobStatus, prisma } from "@repo/db";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { QUEUE_NAMES } from "./queue";

import { closeJobs, enqueueTriggerDeploy } from "./index";

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "enqueueTriggerDeploy",
  () => {
    const siteIds: Array<string> = [];

    beforeAll(async () => {
      for (const domain of ["deploy-a.jobs.test", "deploy-b.jobs.test"]) {
        const site = await prisma.site.upsert({
          create: { domain },
          update: {},
          where: { domain },
        });
        siteIds.push(site.id);
      }
      await prisma.job.deleteMany({
        where: { kind: JobKind.TRIGGER_DEPLOY, siteId: { in: siteIds } },
      });
    });

    afterAll(async () => {
      const admin = new Redis(process.env.REDIS_URL ?? "", { maxRetriesPerRequest: null });
      const queue = new Queue(QUEUE_NAMES[JobKind.TRIGGER_DEPLOY], { connection: admin });
      await queue.obliterate({ force: true });
      await queue.close();
      await admin.quit();
      await prisma.job.deleteMany({ where: { siteId: { in: siteIds } } });
      await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
      await closeJobs();
    });

    it("skips while a deploy for the same site is in flight and enqueues once it settles", async () => {
      const [siteA = "", siteB = ""] = siteIds;

      const racing = await Promise.all([enqueueTriggerDeploy(siteA), enqueueTriggerDeploy(siteA)]);
      const otherSite = await enqueueTriggerDeploy(siteB);
      const first = racing.find((result) => !result.skipped);

      expect(racing.filter((result) => result.skipped)).toEqual([{ jobId: null, skipped: true }]);
      expect(otherSite.skipped).toBe(false);

      await prisma.job.update({
        data: { status: JobStatus.DONE },
        where: { id: first?.jobId ?? "" },
      });

      const afterSettle = await enqueueTriggerDeploy(siteA);

      expect(afterSettle.skipped).toBe(false);
    });
  },
);
