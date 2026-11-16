import { JobKind, createPrismaClient } from "@repo/db";
import { countJobs } from "@repo/jobs";
import { afterEach, describe, expect, it } from "vitest";

import { update, updateSchedule } from "./index";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");

describe.runIf(process.env.TEST_DATABASE === "true")("Site build projection", () => {
  let siteId = "";

  const fixture = async (
    isEnabled = true,
    vercelDeployHookUrl: string | null = "https://deploy.test/hook",
  ) => {
    const site = await prisma.site.create({
      data: {
        authorName: "Author",
        domain: `author-${crypto.randomUUID()}.test`,
        isEnabled,
        vercelDeployHookUrl,
      },
    });

    siteId = site.id;
  };

  const deploys = () => countJobs(prisma, { kinds: [JobKind.TRIGGER_DEPLOY], siteId });
  afterEach(async () => {
    await prisma.job.deleteMany({ where: { siteId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
  });
  it.each(["authorName", "authorBio", "authorPhotoUrl", "authorUrl"] as const)(
    "coalesces a rebuild for %s",
    async (field) => {
      await fixture();
      await Promise.all([
        update(prisma, siteId, { [field]: "Changed" }),
        update(prisma, siteId, { [field]: "Changed" }),
      ]);
      expect(await deploys()).toBe(1);
    },
  );
  it("does not build for no-op, schedule, or hint patches", async () => {
    await fixture();
    await update(prisma, siteId, { authorName: "Author" });
    await update(prisma, siteId, { topicHints: "Topic" });
    await updateSchedule(prisma, siteId, { cadenceDays: 3, lastAutoPublishedAt: new Date() });
    expect(await deploys()).toBe(0);
  });
  it.each([
    [false, "https://deploy.test/hook"],
    [true, null],
  ] as const)("preserves the deploy gate %s %s", async (enabled, hook) => {
    await fixture(enabled, hook);
    await update(prisma, siteId, { authorName: "Changed" });
    expect(await deploys()).toBe(0);
  });
});
