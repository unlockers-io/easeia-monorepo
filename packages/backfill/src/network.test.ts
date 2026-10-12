import { setTimeout as sleep } from "node:timers/promises";

import { JobKind, JobStatus, PostStatus, prisma } from "@repo/db";
import {
  closeJobs,
  consume,
  countJobs,
  findLatestJob,
  getJob,
  type ConsumerContext,
} from "@repo/jobs";
import type { Worker } from "bullmq";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { BackfillAlreadyRunningError, networkBackfill } from "./index";

type Handler = (ctx: ConsumerContext<typeof JobKind.BACKFILL_NETWORK>) => Promise<void>;

const until = async <T>(read: () => Promise<T>, holds: (value: T) => boolean): Promise<T> => {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const value = await read();
    if (holds(value)) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error("condition never held");
    }
    await sleep(50);
  }
};

const settled = (jobId: string) =>
  until(
    () => getJob(jobId),
    (job) => job?.status === JobStatus.DONE || job?.status === JobStatus.FAILED,
  );

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "networkBackfill on Postgres and Redis",
  () => {
    const run = `backfill-${Date.now()}`;
    const runStartedAt = new Date();
    const workers: Array<Worker> = [];
    let siteId = "";

    const serve = (handler: Handler, isRetryable?: (cause: unknown) => boolean) => {
      workers.push(
        consume({ concurrency: 1, handler, isRetryable, kind: JobKind.BACKFILL_NETWORK }),
      );
    };
    const stopServing = async () => {
      await Promise.all(workers.splice(0).map((worker) => worker.close()));
    };

    beforeAll(async () => {
      const site = await prisma.site.create({ data: { domain: `${run}.test` } });
      siteId = site.id;
      await prisma.post.create({
        data: { body: "Body", siteId, slug: run, status: PostStatus.PUBLISHED, title: run },
      });
    });

    afterEach(stopServing);

    afterAll(async () => {
      const drain = [JobKind.BACKFILL_NETWORK, JobKind.CLASSIFY, JobKind.EMBED].map((kind) =>
        consume({ handler: () => Promise.resolve(), kind }),
      );
      await until(
        () =>
          countJobs({
            createdSince: runStartedAt,
            kinds: [JobKind.CLASSIFY, JobKind.EMBED],
            status: JobStatus.QUEUED,
          }),
        (queued) => queued === 0,
      );
      await Promise.all(drain.map((worker) => worker.close()));
      await prisma.site.delete({ where: { id: siteId } });
      await closeJobs();
    }, 30_000);

    it("starts one run at a time and reports it active", async () => {
      const starts = await Promise.allSettled([networkBackfill.start(), networkBackfill.start()]);

      expect(starts.filter((start) => start.status === "fulfilled")).toHaveLength(1);
      expect(starts.find((start) => start.status === "rejected")?.reason).toBeInstanceOf(
        BackfillAlreadyRunningError,
      );
      expect(await networkBackfill.readStatus()).toMatchObject({
        active: true,
        counts: { failed: 0 },
        ended: null,
        phase: "CLASSIFY_EMBED",
      });
    });

    it("frees the guard once the run fails", async () => {
      const failing = await findLatestJob(JobKind.BACKFILL_NETWORK);
      serve(
        () => Promise.reject(new Error("tick failed")),
        () => false,
      );
      await settled(failing?.id ?? "");
      await stopServing();

      expect(await networkBackfill.readStatus()).toMatchObject({
        active: false,
        counts: { failed: 1 },
        ended: "failed",
      });
      await expect(networkBackfill.start()).resolves.toEqual({ jobId: expect.any(String) });
    });

    it("fans out to every published post, then schedules its next tick", async () => {
      const first = await findLatestJob(JobKind.BACKFILL_NETWORK);
      serve(networkBackfill.tick);
      await settled(first?.id ?? "");

      const next = await findLatestJob(JobKind.BACKFILL_NETWORK);
      const since = new Date(next?.payload.startedAt ?? "");
      const published = await prisma.post.count({ where: { status: PostStatus.PUBLISHED } });

      expect(next).toMatchObject({
        payload: { initialFanoutDone: true, phase: "CLASSIFY_EMBED" },
        status: JobStatus.QUEUED,
      });
      expect(next?.id).not.toBe(first?.id);
      expect(published).toBeGreaterThan(0);
      expect(await countJobs({ createdSince: since, kinds: [JobKind.CLASSIFY] })).toBe(published);
      expect(await countJobs({ createdSince: since, kinds: [JobKind.EMBED] })).toBe(published);
      await expect(networkBackfill.start()).rejects.toBeInstanceOf(BackfillAlreadyRunningError);
    });

    it("reports a chain that ends without a successor as done", async () => {
      const last = await findLatestJob(JobKind.BACKFILL_NETWORK);
      serve(() => Promise.resolve());
      await settled(last?.id ?? "");
      await stopServing();

      expect(await networkBackfill.readStatus()).toMatchObject({
        active: false,
        ended: "done",
        phase: "DONE",
      });
      const { jobId } = await networkBackfill.start();
      serve(() => Promise.resolve());
      await settled(jobId);
    }, 30_000);
  },
);
