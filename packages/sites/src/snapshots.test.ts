import { JobKind, prisma } from "@repo/db";
import { closeJobs, countJobs } from "@repo/jobs";
import { afterAll, describe, expect, it } from "vitest";

import { requestSnapshots } from "./index";

const snapshotJobs = (siteId: string) => countJobs({ kinds: [JobKind.SNAPSHOT_SITE], siteId });

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "requestSnapshots",
  () => {
    const run = `snapshots-${Date.now()}`;
    const siteIds: Array<string> = [];

    const createSite = async (name: string, isEnabled = true) => {
      const site = await prisma.site.create({ data: { domain: `${name}.${run}.test`, isEnabled } });
      siteIds.push(site.id);
      return site.id;
    };

    afterAll(async () => {
      await prisma.job.deleteMany({ where: { siteId: { in: siteIds } } });
      await prisma.site.deleteMany({ where: { id: { in: siteIds } } });
      await closeJobs();
    });

    it("queues one snapshot per enabled Site still missing today's", async () => {
      const now = new Date();
      const due = await createSite("due");
      const disabled = await createSite("disabled", false);
      const taken = await createSite("taken");
      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      await prisma.siteSnapshot.create({ data: { date: today, reachable: true, siteId: taken } });

      await requestSnapshots(now);
      await requestSnapshots(now);

      expect(await snapshotJobs(due)).toBe(1);
      expect(await snapshotJobs(disabled)).toBe(0);
      expect(await snapshotJobs(taken)).toBe(0);
    });
  },
);
