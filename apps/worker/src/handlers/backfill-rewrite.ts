import { JobKind, prisma } from "@repo/db";
import {
  countEligibleRewritePosts,
  eligibleRewritePostsWhere,
  enqueue,
  nextBackfillRewritePhase,
  readBackfillRewriteCounts,
  runPhaseOrchestrator,
  type BackfillRewriteCounts,
  type BackfillRewritePayload,
  type BackfillRewritePhase,
  type ConsumerContext,
  type PhaseLog,
} from "@repo/jobs";

import { env } from "../lib/env";
import { createJobLogger } from "../lib/logger";
import { settleFanout, type JobLog } from "../lib/settle-fanout";

const POLL_DELAY_MS = 10_000;

type WorkerJobLog = PhaseLog & JobLog;
type BackfillRewriteDependencies = {
  countEligible: typeof countEligibleRewritePosts;
  createLogger: (context: Parameters<typeof createJobLogger>[0]) => WorkerJobLog;
  enqueueJob: typeof enqueue;
  findEligiblePosts: (force: boolean) => Promise<ReadonlyArray<{ id: string }>>;
  findMoneySites: () => Promise<ReadonlyArray<{ id: string }>>;
  readCounts: typeof readBackfillRewriteCounts;
  redisUrl: string;
  settle: typeof settleFanout;
  updateJobPayload: (jobId: string, payload: BackfillRewritePayload) => Promise<void>;
};

const fanout = async (
  dependencies: BackfillRewriteDependencies,
  phase: BackfillRewritePhase,
  force: boolean,
  log: JobLog,
): Promise<void> => {
  if (phase === "CRAWL_MONEY_SITE") {
    const sites = await dependencies.findMoneySites();
    await dependencies.settle(
      sites.map((s) => ({
        id: s.id,
        run: async () => {
          await dependencies.enqueueJob({
            kind: JobKind.CRAWL_MONEY_SITE,
            payload: { moneySiteId: s.id },
            redisUrl: dependencies.redisUrl,
          });
        },
      })),
      "backfill-rewrite: CRAWL_MONEY_SITE enqueue failed",
      log,
    );
    return;
  }
  if (phase === "REWRITE_POST") {
    const posts = await dependencies.findEligiblePosts(force);
    await dependencies.settle(
      posts.map((p) => ({
        id: p.id,
        run: async () => {
          await dependencies.enqueueJob({
            kind: JobKind.REWRITE_POST,
            payload: { force, postId: p.id },
            postId: p.id,
            redisUrl: dependencies.redisUrl,
          });
        },
      })),
      "backfill-rewrite: REWRITE_POST enqueue failed",
      log,
    );
  }
};

const reEnqueueSelf = async (
  dependencies: BackfillRewriteDependencies,
  payload: BackfillRewritePayload,
): Promise<void> => {
  await dependencies.enqueueJob({
    delayMs: POLL_DELAY_MS,
    kind: JobKind.BACKFILL_REWRITE,
    payload,
    redisUrl: dependencies.redisUrl,
  });
};

const createHandleBackfillRewrite = (dependencies: BackfillRewriteDependencies) =>
  async function handleBackfillRewrite(ctx: ConsumerContext<"BACKFILL_REWRITE">): Promise<void> {
    const { jobId, payload } = ctx;
    const force = payload.force === true;
    const log = dependencies.createLogger({ jobId, queue: "backfill-rewrite" });

    await runPhaseOrchestrator<BackfillRewritePhase, BackfillRewriteCounts, BackfillRewritePayload>(
      {
        afterInitialFanout: async () => ({
          initialPostsEligible: await dependencies.countEligible(force),
        }),
        context: { force },
        fanout: (phase) => fanout(dependencies, phase, force, log),
        label: "backfill-rewrite",
        log,
        markDone: (carry) =>
          dependencies.updateJobPayload(jobId, {
            force,
            initialFanoutDone: true,
            initialPostsEligible: carry.initialPostsEligible ?? payload.initialPostsEligible,
            phase: "DONE",
            startedAt: payload.startedAt,
          }),
        payload,
        reEnqueue: (nextPayload) => reEnqueueSelf(dependencies, nextPayload),
        tick: async () => {
          const initialPostsEligible =
            payload.initialPostsEligible ?? (await dependencies.countEligible(force));
          const counts = await dependencies.readCounts(
            new Date(payload.startedAt),
            initialPostsEligible,
          );
          return {
            carry: { initialPostsEligible },
            counts,
            next: nextBackfillRewritePhase(payload.phase, counts),
          };
        },
      },
    );
  };

const handleBackfillRewrite = createHandleBackfillRewrite({
  countEligible: countEligibleRewritePosts,
  createLogger: createJobLogger,
  enqueueJob: enqueue,
  findEligiblePosts: (force) =>
    prisma.post.findMany({ select: { id: true }, where: eligibleRewritePostsWhere(force) }),
  findMoneySites: () =>
    prisma.moneySite.findMany({ select: { id: true }, where: { isEnabled: true } }),
  readCounts: readBackfillRewriteCounts,
  redisUrl: env.REDIS_URL,
  settle: settleFanout,
  updateJobPayload: async (jobId, payload) => {
    await prisma.job.update({ data: { payload }, where: { id: jobId } });
  },
});

export { createHandleBackfillRewrite, handleBackfillRewrite };
export type { BackfillRewriteDependencies };
