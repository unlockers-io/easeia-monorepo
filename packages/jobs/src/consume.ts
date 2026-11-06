import { type Job, type JobKind, JobStatus, type Prisma, prisma } from "@repo/db";
import { UnrecoverableError, Worker, type Job as BullJob } from "bullmq";

import { type ConsumerContext, JobSkippedError } from "./context";
import { parsePayload } from "./payloads";
import { describeError, queueName, redisConnection } from "./transport";

type ConsumeOptions<K extends JobKind> = {
  concurrency?: number;
  handler: (ctx: ConsumerContext<K>) => Promise<void>;
  isRetryable?: (cause: unknown) => boolean;
  kind: K;
  onFailure?: (ctx: ConsumerContext<K>) => Promise<void>;
};

const runFor = (row: Pick<Job, "runId" | "phase">): ConsumerContext<JobKind>["run"] => {
  if (row.runId === null) {
    return undefined;
  }

  if (row.phase === null) {
    throw new Error("Run child is missing its phase");
  }

  return { id: row.runId, phase: row.phase };
};

const recordFailure = async (jobId: string, error: unknown, retry: boolean): Promise<void> => {
  if (error instanceof JobSkippedError) {
    await prisma.job.update({
      data: { finishedAt: new Date(), lastError: error.message, status: JobStatus.SKIPPED },
      where: { id: jobId },
    });

    return;
  }

  const lastError = describeError(error);
  await prisma.job.update({
    data: {
      finishedAt: retry ? null : new Date(),
      lastError,
      status: retry ? JobStatus.QUEUED : JobStatus.FAILED,
    },
    where: { id: jobId },
  });
  throw retry ? error : new UnrecoverableError(lastError);
};

export const consume = <K extends JobKind>(options: ConsumeOptions<K>): Worker =>
  new Worker(
    queueName(options.kind),
    async (bull: BullJob<Prisma.InputJsonObject>) => {
      const jobId = bull.id;

      if (jobId === undefined || jobId === "") {
        throw new UnrecoverableError(`BullMQ job has no id (kind=${options.kind})`);
      }

      const finalAttempt = bull.attemptsMade + 1 >= (bull.opts.attempts ?? 1);
      const startedAt = new Date();

      const row = await prisma.job.upsert({
        create: {
          attempts: 1,
          id: jobId,
          kind: options.kind,
          payload: bull.data,
          queueJobId: jobId,
          startedAt,
          status: JobStatus.RUNNING,
        },
        update: { attempts: { increment: 1 }, startedAt, status: JobStatus.RUNNING },
        where: { id: jobId },
      });

      let context: ConsumerContext<K>;

      try {
        const run = runFor(row);
        context = { jobId, payload: parsePayload(options.kind, bull.data) };

        if (run !== undefined) {
          context.run = run;
        }
      } catch (error) {
        await recordFailure(jobId, error, false);

        return;
      }

      try {
        await options.handler(context);
      } catch (error) {
        const retry = !finalAttempt && (options.isRetryable?.(error) ?? true);

        try {
          if (!retry && !(error instanceof JobSkippedError)) {
            await options.onFailure?.(context);
          }
        } finally {
          await recordFailure(jobId, error, retry);
        }

        return;
      }

      await prisma.job.update({
        data: { finishedAt: new Date(), lastError: null, status: JobStatus.DONE },
        where: { id: jobId },
      });
    },
    { concurrency: options.concurrency ?? 4, connection: redisConnection() },
  );
