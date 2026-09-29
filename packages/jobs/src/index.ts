import { type JobKind, JobStatus, type Prisma, prisma } from "@repo/db";
import { Worker, type Job as BullJob } from "bullmq";

import { closeQueues, getRedis, QUEUE_NAMES } from "./enqueue-core";
import type { JobPayloads } from "./payloads";

export { enqueue, QUEUE_NAMES } from "./enqueue-core";
export type { EnqueuedJob, EnqueueInput } from "./enqueue-core";

export { getJobPayload, getStoredJobPayload } from "./payloads";
export type { BackfillGscLinksPayload, JobPayloads } from "./payloads";

export { asLoggableError, fanoutRejections } from "./settled";
export type { FanoutRejection } from "./settled";

export {
  BACKFILL_NETWORK_PHASES,
  isBackfillNetworkPhase,
  nextBackfillNetworkPhase,
  readBackfillNetworkCounts,
} from "./backfill-network";
export type {
  BackfillNetworkCounts,
  BackfillNetworkPayload,
  BackfillNetworkPhase,
} from "./backfill-network";

export {
  countEligibleRewritePosts,
  eligibleRewritePostsWhere,
  nextBackfillRewritePhase,
  readBackfillRewriteCounts,
} from "./backfill-rewrite";
export type {
  BackfillRewriteCounts,
  BackfillRewritePayload,
  BackfillRewritePhase,
} from "./backfill-rewrite";

export { runPhaseOrchestrator } from "./phase-orchestrator";
export type { PhaseLog, PhaseOrchestratorSpec, PhasePayload } from "./phase-orchestrator";

export { enqueueTriggerDeploy } from "./enqueue-trigger-deploy";
export type {
  EnqueueTriggerDeployInput,
  EnqueueTriggerDeployResult,
} from "./enqueue-trigger-deploy";

type ConsumerOptions<K extends JobKind> = {
  concurrency?: number;
  handler: (ctx: ConsumerContext<K>) => Promise<void>;
  kind: K;
  redisUrl: string;
};

export type ConsumerContext<K extends JobKind> = {
  attemptsMade: number; // 0-indexed; 0 = first try
  finalAttempt: boolean;
  jobId: string; // DB Job id
  payload: JobPayloads[K];
};

export const consume = <K extends JobKind>(options: ConsumerOptions<K>): Worker => {
  const queueName = QUEUE_NAMES[options.kind];
  const worker = new Worker(
    queueName,
    async (bull: BullJob<JobPayloads[K] & { jobId?: string }>) => {
      const jobId = bull.data.jobId ?? bull.id;
      if (jobId === undefined || jobId === "") {
        throw new Error(`BullMQ job missing jobId in payload (kind=${options.kind})`);
      }
      const totalAttempts = bull.opts.attempts ?? 1;
      const attemptsMade = bull.attemptsMade;
      const finalAttempt = attemptsMade + 1 >= totalAttempts;

      await prisma.job.update({
        data: {
          attempts: { increment: 1 },
          startedAt: new Date(),
          status: JobStatus.RUNNING,
        },
        where: { id: jobId },
      });

      try {
        await options.handler({
          attemptsMade,
          finalAttempt,
          jobId,
          payload: bull.data,
        });
        await prisma.job.update({
          data: {
            finishedAt: new Date(),
            lastError: null,
            status: JobStatus.DONE,
          },
          where: { id: jobId },
        });
      } catch (error) {
        const lastError =
          error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        await prisma.job.update({
          data: {
            finishedAt: finalAttempt ? new Date() : null,
            lastError,
            status: finalAttempt ? JobStatus.FAILED : JobStatus.QUEUED,
          },
          where: { id: jobId },
        });
        throw error;
      }
    },
    {
      concurrency: options.concurrency ?? 4,
      connection: getRedis(options.redisUrl),
    },
  );
  return worker;
};

/**
 * Close every BullMQ Queue this process opened and quit the shared
 * Redis connection. Call from short-lived CLIs so Node can exit; the
 * long-running worker leaves these handles open by design.
 */
export const closeJobs = async (): Promise<void> => {
  await closeQueues();
};

type UpdateJobs = (args: Prisma.JobUpdateManyArgs) => Promise<{ count: number }>;

const createReapStuckJobs =
  (updateJobs: UpdateJobs) =>
  async (maxAgeMs = 30 * 60 * 1000): Promise<{ reaped: number }> => {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await updateJobs({
      data: {
        finishedAt: new Date(),
        lastError: "stuck: reaped by reconciliation",
        status: JobStatus.FAILED,
      },
      where: {
        // Delayed jobs can be old before their first attempt, so creation age
        // cannot distinguish a scheduled job from a stuck job.
        OR: [
          { startedAt: { lt: cutoff, not: null }, status: JobStatus.RUNNING },
          // A queued job with a recorded attempt lost its BullMQ retry. The
          // attempts check excludes jobs waiting for their initial delay.
          {
            attempts: { gt: 0 },
            startedAt: { lt: cutoff, not: null },
            status: JobStatus.QUEUED,
          },
        ],
      },
    });
    return { reaped: result.count };
  };

const reapStuckJobs = createReapStuckJobs((args) => prisma.job.updateMany(args));

export { createReapStuckJobs, reapStuckJobs };
export type { UpdateJobs };

export { JobKind } from "@repo/db";

export {
  createOrchestratorStatusReader,
  readOrchestratorStatus,
  type OrchestratorStatusDependencies,
  type StoredOrchestrator,
} from "./orchestrator-status";
export { readBackfillNetworkStatus, readBackfillRewriteStatus } from "./network-status";
