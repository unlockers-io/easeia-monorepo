import { setTimeout as sleep } from "node:timers/promises";

import { JobKind, JobStatus, prisma } from "@repo/db";
import { Queue, type Worker } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { QUEUE_NAMES } from "./queue";

import {
  closeJobs,
  consume,
  dispatchPendingJobs,
  enqueue,
  JobSkippedError,
  type ConsumerContext,
} from "./index";

const KIND = JobKind.SNAPSHOT_SITE;

class NotConfiguredError extends Error {}

describe.runIf(process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true")(
  "consume",
  () => {
    const createdIds: Array<string> = [];
    let admin: Redis;
    let queue: Queue;
    let worker: Worker | undefined;

    beforeAll(async () => {
      admin = new Redis(process.env.REDIS_URL ?? "", { maxRetriesPerRequest: null });
      queue = new Queue(QUEUE_NAMES[KIND], { connection: admin });
      await queue.obliterate({ force: true });
    });

    afterEach(async () => {
      await worker?.close();
      worker = undefined;
    });

    afterAll(async () => {
      await prisma.job.deleteMany({ where: { id: { in: createdIds } } });
      await queue.obliterate({ force: true });
      await queue.close();
      await admin.quit();
      await closeJobs();
    });

    const run = async (
      handler: (ctx: ConsumerContext<typeof KIND>) => Promise<void>,
      isRetryable?: (cause: unknown) => boolean,
    ) => {
      worker = consume({ handler, isRetryable, kind: KIND });
      const { id } = await enqueue({ kind: KIND, payload: { siteId: "site_unused" } });
      createdIds.push(id);
      await dispatchPendingJobs();

      for (let tick = 0; tick < 400; tick += 1) {
        await queue.promoteJobs();
        const job = await prisma.job.findUniqueOrThrow({ where: { id } });

        if (
          job.status === JobStatus.DONE ||
          job.status === JobStatus.FAILED ||
          job.status === JobStatus.SKIPPED
        ) {
          return job;
        }

        await sleep(25);
      }

      throw new Error(`Job ${id} never settled`);
    };

    it("hands the handler its Job and payload, then marks the Job DONE", async () => {
      const seen: Array<ConsumerContext<typeof KIND>> = [];

      const job = await run((ctx) => {
        seen.push(ctx);

        return Promise.resolve();
      });

      expect(job).toMatchObject({ attempts: 1, lastError: null, status: JobStatus.DONE });
      expect(job.finishedAt).not.toBeNull();
      expect(seen).toEqual([
        { attemptsMade: 0, finalAttempt: false, jobId: job.id, payload: { siteId: "site_unused" } },
      ]);
    });

    it("retries a throwing handler until attempts run out, then marks the Job FAILED", async () => {
      const calls: Array<{ attemptsMade: number; finalAttempt: boolean }> = [];

      const job = await run(({ attemptsMade, finalAttempt }) => {
        calls.push({ attemptsMade, finalAttempt });

        return Promise.reject(new Error("boom"));
      });

      expect(job).toMatchObject({
        attempts: 5,
        lastError: "Error: boom",
        status: JobStatus.FAILED,
      });
      expect(job.finishedAt).not.toBeNull();
      expect(calls.map((call) => call.attemptsMade)).toEqual([0, 1, 2, 3, 4]);
      expect(calls.map((call) => call.finalAttempt)).toEqual([false, false, false, false, true]);
    }, 30_000);

    it("records an explicit skip as a terminal outcome", async () => {
      const job = await run(() => Promise.reject(new JobSkippedError("AI unavailable")));
      expect(job.status).toBe(JobStatus.SKIPPED);
    });

    it("fails a non-retryable error after one attempt", async () => {
      let calls = 0;

      const job = await run(
        () => {
          calls += 1;

          return Promise.reject(new NotConfiguredError("AI is not configured"));
        },
        (error) => !(error instanceof NotConfiguredError),
      );

      await queue.promoteJobs();
      const bullJob = await queue.getJob(job.id);

      expect(job).toMatchObject({
        attempts: 1,
        lastError: "Error: AI is not configured",
        status: JobStatus.FAILED,
      });
      expect(await bullJob?.getState()).toBe("failed");
      expect(calls).toBe(1);
    });

    it("keeps retrying errors the classifier accepts", async () => {
      let calls = 0;

      const job = await run(
        () => {
          calls += 1;

          return calls < 3 ? Promise.reject(new Error("flaky")) : Promise.resolve();
        },
        (error) => !(error instanceof NotConfiguredError),
      );

      expect(job).toMatchObject({ attempts: 3, lastError: null, status: JobStatus.DONE });
    }, 30_000);
  },
);
