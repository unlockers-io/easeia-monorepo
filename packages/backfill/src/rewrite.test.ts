import { JobKind, JobStatus, createPrismaClient } from "@repo/db";
import { listRunJobs } from "@repo/jobs";
import { afterEach, describe, expect, it } from "vitest";

import { enqueuePostMember } from "./members";

import { rewriteBackfill } from "./index";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");

describe.runIf(process.env.TEST_DATABASE === "true")("run-scoped rewrite backfill", () => {
  let siteId = "";
  let runId = "";
  afterEach(async () => {
    delete process.env.OPENAI_API_KEY;
    await prisma.job.deleteMany({ where: { runId } });
    await prisma.backfillRun.deleteMany({ where: { id: runId } });
    await prisma.site.deleteMany({ where: { id: siteId } });
  });
  it("advances through an empty crawl catalog and freezes eligible posts", async () => {
    process.env.OPENAI_API_KEY = "sk-test";

    const site = await prisma.site.create({
      data: {
        domain: `rewrite-${crypto.randomUUID()}.test`,
        vercelDeployHookUrl: "https://deploy.test/hook",
      },
    });

    siteId = site.id;

    const post = await prisma.post.create({
      data: { body: "Body", siteId, slug: "post", status: "PUBLISHED", title: "Post" },
    });

    const started = await rewriteBackfill.start(prisma, { force: false });
    runId = started.runId;
    await rewriteBackfill.tick(prisma);
    const jobs = await listRunJobs(prisma, runId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: JobKind.REWRITE_POST, postId: post.id });
    await prisma.post.update({ data: { status: "ARCHIVED" }, where: { id: post.id } });
    await prisma.$transaction((tx) =>
      enqueuePostMember(
        {
          kind: JobKind.REWRITE_POST,
          payload: { postId: post.id },
          postId: post.id,
          run: { id: runId, member: "archived", phase: "REWRITE_POST" },
        },
        tx,
      ),
    );
    const children = await listRunJobs(prisma, runId);
    expect(children.some((job) => job.status === JobStatus.SKIPPED)).toBe(true);
    await prisma.job.updateMany({
      data: { status: JobStatus.DONE },
      where: { runId, status: JobStatus.QUEUED },
    });
    await rewriteBackfill.tick(prisma);
    expect(await rewriteBackfill.readStatus(prisma)).toMatchObject({
      active: false,
      counts: { skipped: 1 },
      ended: "done",
    });
  });
});
