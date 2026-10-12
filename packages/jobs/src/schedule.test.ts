import { JobKind, JobStatus, prisma } from "@repo/db";
import { Queue, type Worker } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { QUEUE_NAMES } from "./queue";

import { closeJobs, consume, schedule, unschedule } from "./index";

const KIND = JobKind.AUDIT_SLUG_DRIFT;

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "schedule",
  () => {
    const since = new Date();
    let admin: Redis;
    let queue: Queue;
    const workers: Array<Worker> = [];

    const ticks = () => prisma.job.findMany({ where: { createdAt: { gte: since }, kind: KIND } });

    beforeAll(async () => {
      admin = new Redis(process.env.REDIS_URL ?? "", { maxRetriesPerRequest: null });
      queue = new Queue(QUEUE_NAMES[KIND], { connection: admin });
      await queue.obliterate({ force: true });
    });

    afterAll(async () => {
      await Promise.all(workers.map((worker) => worker.close()));
      await unschedule(KIND);
      await prisma.job.deleteMany({ where: { createdAt: { gte: since }, kind: KIND } });
      await queue.obliterate({ force: true });
      await queue.close();
      await admin.quit();
      await closeJobs();
    });

    it("runs each tick once as its own DONE Job row, whatever the replica count", async () => {
      const handler = vi.fn(() => Promise.resolve());
      const replicas = 3;
      for (let replica = 0; replica < replicas; replica += 1) {
        await schedule({ everyMs: 400, kind: KIND, payload: {} });
        workers.push(consume({ handler, kind: KIND }));
      }

      await vi.waitFor(
        async () => {
          const rows = await ticks();
          const done = rows.filter((job) => job.status === JobStatus.DONE);
          expect(done.length).toBeGreaterThanOrEqual(2);
        },
        { interval: 50, timeout: 5000 },
      );
      await unschedule(KIND);
      await Promise.all(workers.map((worker) => worker.close()));

      const rows = await ticks();
      expect(await queue.getJobSchedulersCount()).toBe(0);
      expect(handler).toHaveBeenCalledTimes(rows.length);
      expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
      expect(rows.every((row) => row.attempts === 1 && row.queueJobId === row.id)).toBe(true);
    });

    it("keeps one scheduler when replicas register it again", async () => {
      await schedule({ everyMs: 60_000, kind: KIND, payload: {} });
      const [first] = await queue.getJobSchedulers();
      await schedule({ everyMs: 60_000, kind: KIND, payload: {} });
      const [again] = await queue.getJobSchedulers();

      expect(await queue.getJobSchedulersCount()).toBe(1);
      expect(again?.next).toBe(first?.next);
    });
  },
);
