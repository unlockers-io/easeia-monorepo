import { JobKind, PostStatus, prisma } from "@repo/db";
import {
  enqueue,
  isBackfillNetworkPhase,
  nextBackfillNetworkPhase,
  readBackfillNetworkCounts,
  runPhaseOrchestrator,
  type BackfillNetworkCounts,
  type BackfillNetworkPayload,
  type BackfillNetworkPhase,
  type ConsumerContext,
  type PhaseLog,
} from "@repo/jobs";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";
import { settleFanout, type JobLog } from "../lib/settle-fanout";

const POLL_DELAY_MS = 10_000;

type WorkerJobLog = PhaseLog & JobLog;
type BackfillNetworkDependencies = {
  createLogger: (context: Parameters<typeof createJobLogger>[0]) => WorkerJobLog;
  enqueueJob: typeof enqueue;
  findPublishedPosts: () => Promise<ReadonlyArray<{ id: string }>>;
  readCounts: typeof readBackfillNetworkCounts;
  redisUrl: string;
  settle: typeof settleFanout;
  updateJobPayload: (jobId: string, payload: BackfillNetworkPayload) => Promise<void>;
};

const fanout = async (
  dependencies: BackfillNetworkDependencies,
  phase: BackfillNetworkPhase,
  log: JobLog,
): Promise<void> => {
  if (phase === "CLASSIFY_EMBED") {
    const posts = await dependencies.findPublishedPosts();
    await dependencies.settle(
      posts.flatMap((p) => [
        {
          id: p.id,
          run: async () => {
            await dependencies.enqueueJob({
              kind: JobKind.CLASSIFY,
              payload: { postId: p.id },
              postId: p.id,
              redisUrl: dependencies.redisUrl,
            });
          },
        },
        {
          id: p.id,
          run: async () => {
            await dependencies.enqueueJob({
              kind: JobKind.EMBED,
              payload: { postId: p.id },
              postId: p.id,
              redisUrl: dependencies.redisUrl,
            });
          },
        },
      ]),
      "backfill-network: CLASSIFY_EMBED enqueue failed",
      log,
    );
    return;
  }
  if (phase === "SUGGEST_LINKS") {
    const posts = await dependencies.findPublishedPosts();
    await dependencies.settle(
      posts.map((p) => ({
        id: p.id,
        run: async () => {
          await dependencies.enqueueJob({
            kind: JobKind.SUGGEST_LINKS,
            payload: { postId: p.id },
            postId: p.id,
            redisUrl: dependencies.redisUrl,
          });
        },
      })),
      "backfill-network: SUGGEST_LINKS enqueue failed",
      log,
    );
  }
};

const reEnqueueSelf = async (
  dependencies: BackfillNetworkDependencies,
  payload: BackfillNetworkPayload,
): Promise<void> => {
  await dependencies.enqueueJob({
    delayMs: POLL_DELAY_MS,
    kind: JobKind.BACKFILL_NETWORK,
    payload,
    redisUrl: dependencies.redisUrl,
  });
};

const createHandleBackfillNetwork = (dependencies: BackfillNetworkDependencies) =>
  async function handleBackfillNetwork(ctx: ConsumerContext<"BACKFILL_NETWORK">): Promise<void> {
    const { jobId, payload } = ctx;
    const log = dependencies.createLogger({ jobId, queue: "backfill-network" });

    await runPhaseOrchestrator<BackfillNetworkPhase, BackfillNetworkCounts, BackfillNetworkPayload>(
      {
        fanout: (phase) => fanout(dependencies, phase, log),
        isPhase: isBackfillNetworkPhase,
        label: "backfill",
        log,
        markDone: () =>
          dependencies.updateJobPayload(jobId, {
            initialFanoutDone: true,
            phase: "DONE",
            startedAt: payload.startedAt,
          }),
        payload,
        reEnqueue: (nextPayload) => reEnqueueSelf(dependencies, nextPayload),
        tick: async () => {
          const counts = await dependencies.readCounts(new Date(payload.startedAt));
          return { counts, next: nextBackfillNetworkPhase(payload.phase, counts) };
        },
      },
    );
  };

const handleBackfillNetwork = createHandleBackfillNetwork({
  createLogger: createJobLogger,
  enqueueJob: enqueue,
  findPublishedPosts: () =>
    prisma.post.findMany({
      select: { id: true },
      where: { status: PostStatus.PUBLISHED },
    }),
  readCounts: readBackfillNetworkCounts,
  redisUrl: env.REDIS_URL,
  settle: settleFanout,
  updateJobPayload: async (jobId, payload) => {
    await prisma.job.update({ data: { payload }, where: { id: jobId } });
  },
});

export { createHandleBackfillNetwork, handleBackfillNetwork };
export type { BackfillNetworkDependencies };
