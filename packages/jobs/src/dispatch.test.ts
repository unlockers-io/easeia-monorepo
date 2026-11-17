import { JobKind, JobStatus, createPrismaClient } from "@repo/db";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { queueFor } from "./transport";

const retry = (id: string) => prisma.job.update({ data: { dispatchedAt: null }, where: { id } });

import { closeJobs, dispatchPendingJobs } from "./worker";

import { enqueue, enqueueUnlessQueued } from "./index";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "durable dispatch",
  () => {
    const ids: Array<string> = [];
    const kind = JobKind.SNAPSHOT_SITE;
    const input = { kind, payload: { siteId: "unused" } } as const;
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      for (const id of ids) {
        const job = await queueFor(kind).getJob(id);
        await job?.remove();
      }

      await prisma.job.deleteMany({ where: { id: { in: ids } } });
      await closeJobs();
    });

    const record = async (delayMs = 0) => {
      const row = await enqueue(prisma, { ...input, delayMs });
      ids.push(row.id);

      return row;
    };

    it("recovers a producer exit after commit and preserves delayed availability", async () => {
      const row = await record(3_600_000);
      expect(await queueFor(kind).getJob(row.id)).toBeUndefined();
      await Promise.all([dispatchPendingJobs(prisma), dispatchPendingJobs(prisma)]);
      const bull = await queueFor(kind).getJob(row.id);
      expect(await bull?.getState()).toBe("delayed");
      expect((bull?.timestamp ?? 0) + (bull?.delay ?? 0)).toBeCloseTo(
        row.availableAt.getTime(),
        -2,
      );
      const saved = await prisma.job.findUniqueOrThrow({ where: { id: row.id } });
      expect(saved.queueJobId).toBe(row.id);
      const delayed = await queueFor(kind).getJobs(["delayed"]);
      expect(delayed.filter((job) => job.id === row.id)).toHaveLength(1);
    });

    it("keeps intent queued on Redis submission failure and retries it", async () => {
      const row = await record();
      vi.spyOn(queueFor(kind), "add").mockRejectedValueOnce(new Error("Redis unavailable"));
      await dispatchPendingJobs(prisma);
      expect(await prisma.job.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
        lastError: expect.stringContaining("Redis unavailable"),
        status: JobStatus.QUEUED,
      });
      await retry(row.id);
      await dispatchPendingJobs(prisma);
      expect(await queueFor(kind).getJob(row.id)).toBeDefined();
    });

    it("reuses the BullMQ id after a crash before queue-id recording", async () => {
      const row = await record();
      await queueFor(kind).add("snapshot_site", input.payload, { jobId: row.id });
      vi.spyOn(prisma.job, "updateMany").mockRejectedValueOnce(new Error("recording unavailable"));
      await dispatchPendingJobs(prisma);
      await retry(row.id);
      await dispatchPendingJobs(prisma);
      const waiting = await queueFor(kind).getJobs(["wait"]);
      expect(waiting.filter((job) => job.id === row.id)).toHaveLength(1);
    });

    it("restores a lost initial queue entry instead of holding the coalescing guard forever", async () => {
      const row = await record();
      await dispatchPendingJobs(prisma);
      const lost = await queueFor(kind).getJob(row.id);
      await lost?.remove();
      await retry(row.id);
      expect(await enqueueUnlessQueued(prisma, input)).toBeNull();
      await dispatchPendingJobs(prisma);
      expect(await queueFor(kind).getJob(row.id)).toBeDefined();
    });

    it("rolls back an intent with its enclosing transaction", async () => {
      let id = "";
      await expect(
        prisma.$transaction(async (tx) => {
          const job = await enqueue(tx, input);
          id = job.id;
          throw new Error("abort");
        }),
      ).rejects.toThrow("abort");
      expect(await prisma.job.findUnique({ where: { id } })).toBeNull();
      expect(await queueFor(kind).getJob(id)).toBeUndefined();
    });
  },
);
