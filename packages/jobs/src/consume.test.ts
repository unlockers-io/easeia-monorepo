import { setTimeout as sleep } from "node:timers/promises";

import { JobKind, JobStatus, prisma } from "@repo/db";
import { Queue, type Worker } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { queueName } from "./transport";
import { closeJobs, consume, dispatchPendingJobs } from "./worker";

import { enqueue, JobSkippedError, type ConsumerContext } from "./index";

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
      queue = new Queue(queueName(KIND), { connection: admin });
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
      options: {
        isRetryable?: (cause: unknown) => boolean;
        onFailure?: (ctx: ConsumerContext<typeof KIND>) => Promise<void>;
      } = {},
    ) => {
      worker = consume({ handler, kind: KIND, ...options });
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
      expect(seen).toEqual([{ jobId: job.id, payload: { siteId: "site_unused" } }]);
    });

    it("retries a throwing handler until attempts run out, then fails it once", async () => {
      const events: Array<string> = [];

      const job = await run(
        () => {
          events.push("attempt");

          return Promise.reject(new Error("boom"));
        },
        {
          onFailure: () => {
            events.push("failed");

            return Promise.resolve();
          },
        },
      );

      expect(job).toMatchObject({
        attempts: 5,
        lastError: "Error: boom",
        status: JobStatus.FAILED,
      });
      expect(job.finishedAt).not.toBeNull();
      expect(events).toEqual(["attempt", "attempt", "attempt", "attempt", "attempt", "failed"]);
    }, 30_000);

    it("records an explicit skip as a terminal outcome without failing it", async () => {
      let failed = 0;

      const job = await run(() => Promise.reject(new JobSkippedError("AI unavailable")), {
        onFailure: () => {
          failed += 1;

          return Promise.resolve();
        },
      });

      expect(job.status).toBe(JobStatus.SKIPPED);
      expect(failed).toBe(0);
    });

    it("fails a non-retryable error after one attempt", async () => {
      let calls = 0;
      let failed = 0;

      const job = await run(
        () => {
          calls += 1;

          return Promise.reject(new NotConfiguredError("AI is not configured"));
        },
        {
          isRetryable: (error) => !(error instanceof NotConfiguredError),
          onFailure: () => {
            failed += 1;

            return Promise.resolve();
          },
        },
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
      expect(failed).toBe(1);
    });

    it("keeps retrying errors the classifier accepts", async () => {
      let calls = 0;

      const job = await run(
        () => {
          calls += 1;

          return calls < 3 ? Promise.reject(new Error("flaky")) : Promise.resolve();
        },
        { isRetryable: (error) => !(error instanceof NotConfiguredError) },
      );

      expect(job).toMatchObject({ attempts: 3, lastError: null, status: JobStatus.DONE });
    }, 30_000);
  },
);
