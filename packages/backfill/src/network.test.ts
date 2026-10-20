import { JobKind, JobStatus, PostStatus, prisma } from "@repo/db";
import { closeJobs, consume, dispatchPendingJobs, enqueue, listRunJobs } from "@repo/jobs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { forPublishedMember } from "./members";

import { BackfillAlreadyRunningError, networkBackfill } from "./index";

describe.runIf(process.env.TEST_DATABASE === "true")("run-scoped network backfill", () => {
  let siteId = "";
  const runIds: Array<string> = [];
  const fixture = async () => {
    const site = await prisma.site.create({ data: { domain: `run-${crypto.randomUUID()}.test` } });
    siteId = site.id;
    return prisma.post.create({
      data: { body: "Body", siteId, slug: "post", status: PostStatus.PUBLISHED, title: "Post" },
    });
  };
  const start = async () => {
    const { runId } = await networkBackfill.start();
    runIds.push(runId);
    return runId;
  };
  afterEach(async () => {
    await prisma.job.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.backfillRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.job.deleteMany({ where: { post: { siteId } } });
    await prisma.site.deleteMany({ where: { id: siteId } });
    await closeJobs();
  });

  it("allows one run and finishes honestly after an exhausted child, releasing the guard", async () => {
    await fixture();
    const results = await Promise.allSettled([start(), start()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")?.reason).toBeInstanceOf(
      BackfillAlreadyRunningError,
    );
    const id = runIds.at(-1) ?? "";
    await prisma.job.updateMany({ data: { status: JobStatus.DONE }, where: { runId: id } });
    const [child] = await listRunJobs(id);
    await prisma.job.update({
      data: { attempts: 5, status: JobStatus.FAILED },
      where: { id: child?.id },
    });
    await networkBackfill.tick();
    expect(await networkBackfill.readStatus()).toMatchObject({
      active: false,
      counts: { failed: 1 },
      ended: "failed",
    });
    await expect(start()).resolves.toBeTypeOf("string");
  });

  it("uses frozen members, treats optional-AI skips as terminal, and ignores unrelated work", async () => {
    const original = await fixture();
    const id = await start();
    const late = await prisma.post.create({
      data: { body: "new", siteId, slug: "new", status: PostStatus.PUBLISHED, title: "New" },
    });
    await prisma.job.updateMany({ data: { status: JobStatus.SKIPPED }, where: { runId: id } });
    await enqueue({ kind: JobKind.SUGGEST_LINKS, payload: { postId: late.id }, postId: late.id });
    await networkBackfill.tick();
    await networkBackfill.tick();
    const jobs = await listRunJobs(id);
    expect(
      jobs.filter((job) => job.kind === JobKind.SUGGEST_LINKS).map((job) => job.postId),
    ).toContain(original.id);
    expect(jobs.some((job) => job.postId === late.id)).toBe(false);
    expect(await networkBackfill.readStatus()).toMatchObject({
      active: true,
      counts: { skipped: 2 },
    });
    await prisma.job.updateMany({
      data: { status: JobStatus.DONE },
      where: { phase: "SUGGEST_LINKS", runId: id },
    });
    await networkBackfill.tick();
    expect(await networkBackfill.readStatus()).toMatchObject({ active: false, ended: "done" });
  });

  it("skips deleted or archived members and makes repeated fan-out idempotent", async () => {
    const post = await fixture();
    const id = await start();
    const [child] = await listRunJobs(id);
    const input = {
      kind: JobKind.CLASSIFY,
      payload: { postId: post.id },
      postId: post.id,
      run: { id, member: post.id, phase: "CLASSIFY_EMBED" },
    } as const;
    await Promise.all([enqueue(input), enqueue(input)]);
    expect(await listRunJobs(id)).toHaveLength(2);
    await prisma.post.delete({ where: { id: post.id } });
    await prisma.job.updateMany({ data: { status: JobStatus.SKIPPED }, where: { runId: id } });
    await Promise.all([networkBackfill.tick(), networkBackfill.tick()]);
    expect(await listRunJobs(id)).toHaveLength(3);
    const afterDeletion = await listRunJobs(id);
    expect(afterDeletion.find((job) => job.kind === JobKind.SUGGEST_LINKS)?.status).toBe(
      JobStatus.SKIPPED,
    );
    expect(child?.id).toBeDefined();
    await networkBackfill.tick();
    expect(await networkBackfill.readStatus()).toMatchObject({
      active: false,
      counts: { skipped: 3 },
      ended: "done",
    });
  });

  it.runIf(process.env.TEST_REDIS === "true")(
    "skips members removed or archived before consumption",
    async () => {
      const archived = await fixture();
      const deleted = await prisma.post.create({
        data: { body: "Body", siteId, slug: "deleted", status: "PUBLISHED", title: "Deleted" },
      });
      const id = await start();
      await prisma.post.update({ data: { status: "ARCHIVED" }, where: { id: archived.id } });
      await prisma.post.delete({ where: { id: deleted.id } });
      const handler = vi.fn().mockResolvedValue(undefined);
      const workers = [JobKind.CLASSIFY, JobKind.EMBED].map((kind) =>
        consume({ handler: forPublishedMember(handler), kind }),
      );
      try {
        await dispatchPendingJobs();
        await vi.waitFor(async () => {
          const jobs = await listRunJobs(id);
          expect(jobs.every((job) => job.status === JobStatus.SKIPPED)).toBe(true);
        });
        expect(handler).not.toHaveBeenCalled();
        await networkBackfill.tick();
        await networkBackfill.tick();
        expect(await networkBackfill.readStatus()).toMatchObject({
          active: false,
          counts: { skipped: 6 },
          ended: "done",
        });
      } finally {
        await Promise.all(workers.map((worker) => worker.close()));
      }
    },
  );

  it("finishes an empty member set without polling rows", async () => {
    const id = await start();
    await networkBackfill.tick();
    await networkBackfill.tick();
    expect(await listRunJobs(id)).toHaveLength(0);
    expect(await networkBackfill.readStatus()).toMatchObject({ active: false, ended: "done" });
  });
});
