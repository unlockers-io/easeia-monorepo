import { JobKind, JobStatus, prisma } from "@repo/db";
import { listJobs } from "@repo/jobs";
import { afterEach, describe, expect, it } from "vitest";

import { completePublish, publish, reviseBody, update } from "./index";

const dropFailure = async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS thermo_fail_intent ON "Job"');
  await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS thermo_fail_intent()");
};
const failIntents = async (postId: string) => {
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION thermo_fail_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."postId" = '${postId}' AND NEW.kind = 'EMBED' THEN RAISE EXCEPTION 'injected intent insertion failure'; END IF; RETURN NEW; END $$`,
  );
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER thermo_fail_intent BEFORE INSERT ON "Job" FOR EACH ROW EXECUTE FUNCTION thermo_fail_intent()',
  );
};

describe.runIf(process.env.TEST_DATABASE === "true")("atomic Post consequences", () => {
  let siteId = "";
  const fixture = async (status: "DRAFT" | "PUBLISHED" = "PUBLISHED") => {
    const site = await prisma.site.create({
      data: {
        domain: `atomic-${crypto.randomUUID()}.test`,
        vercelDeployHookUrl: "https://deploy.test/hook",
      },
    });
    siteId = site.id;
    return prisma.post.create({
      data: {
        body: "Before",
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        siteId,
        slug: "post",
        status,
        title: "Title",
      },
    });
  };
  afterEach(async () => {
    await dropFailure();
    await prisma.job.deleteMany({ where: { OR: [{ siteId }, { post: { siteId } }] } });
    await prisma.site.deleteMany({ where: { id: siteId } });
  });
  const jobs = () => listJobs({ limit: 100, siteId });

  it("rolls back a body/rewrite marker if any consequence cannot be recorded", async () => {
    const post = await fixture();
    await failIntents(post.id);
    await expect(
      reviseBody(post.id, { body: "After", from: "Before", rewrittenAt: new Date() }),
    ).rejects.toThrow("injected intent insertion failure");
    expect(await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).toMatchObject({
      body: "Before",
      rewrittenAt: null,
    });
    const rolledBack = await jobs();
    expect(rolledBack.data).toHaveLength(0);
    await dropFailure();
    await reviseBody(post.id, { body: "After", from: "Before", rewrittenAt: new Date() });
    const saved = await jobs();
    expect(saved.data.map((job) => job.kind).toSorted()).toEqual(
      [JobKind.CRAWL_LINKS, JobKind.EMBED, JobKind.TRIGGER_DEPLOY].toSorted(),
    );
    expect(
      saved.data.every((job) => job.status === JobStatus.QUEUED && job.queueJobId === null),
    ).toBe(true);
  });

  it("keeps a publish scheduled and its delayed intent recoverable without Redis", async () => {
    const post = await fixture("DRAFT");
    const scheduledAt = new Date(Date.now() + 3_600_000);
    await update(post.id, { scheduledAt });
    await publish(post.id);
    const queued = await jobs();
    expect(queued.data[0]?.availableAt).toEqual(scheduledAt);
    await failIntents(post.id);
    await expect(completePublish(post.id, { bodyImages: true })).rejects.toThrow(
      "injected intent insertion failure",
    );
    const scheduled = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(scheduled.status).toBe("SCHEDULED");
    await dropFailure();
    await completePublish(post.id, { bodyImages: true });
    await completePublish(post.id, { bodyImages: true });
    const completed = await jobs();
    expect(completed.data.filter((job) => job.kind === JobKind.GENERATE_BODY_IMAGES)).toHaveLength(
      1,
    );
  });

  it("preserves earlier batch intents when a later title repair fails", async () => {
    const first = await fixture();
    const second = await prisma.post.create({
      data: { body: "Before", siteId, slug: "second", status: "PUBLISHED", title: "Second" },
    });
    await update(first.id, { excerpt: null, tags: ["Tag"], title: "Repaired" });
    await failIntents(second.id);
    await expect(update(second.id, { title: "Broken" })).rejects.toThrow(
      "injected intent insertion failure",
    );
    const unchanged = await prisma.post.findUniqueOrThrow({ where: { id: second.id } });
    expect(unchanged.title).toBe("Second");
    const prior = await jobs();
    expect(prior.data.filter((job) => job.kind === JobKind.EMBED)).toHaveLength(1);
    expect(prior.data.filter((job) => job.kind === JobKind.TRIGGER_DEPLOY)).toHaveLength(1);
    await update(first.id, { tags: ["Tag"], title: "Repaired" });
    const unchangedJobs = await jobs();
    expect(unchangedJobs.data).toHaveLength(3);
  });
});
