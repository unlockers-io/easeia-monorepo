import { JobKind, JobStatus, prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

import type { JobPayloads } from "./payloads";
import { inFlight } from "./reads";

let connection: Redis | null = null;

export const redisConnection = (): Redis => {
  if (connection) {
    return connection;
  }
  const url = process.env.REDIS_URL;
  if (url === undefined || url === "") {
    throw new Error("REDIS_URL is required to enqueue or consume Jobs");
  }
  connection = new Redis(url, { maxRetriesPerRequest: null });
  return connection;
};

type QueueNamesContract = Record<JobKind, string>;

export const QUEUE_NAMES = {
  [JobKind.AUDIT_SLUG_DRIFT]: "easeia-audit-slug-drift",
  [JobKind.AUTO_PUBLISH]: "easeia-auto-publish",
  [JobKind.BACKFILL_GSC_LINKS]: "easeia-backfill-gsc-links",
  [JobKind.BACKFILL_HEROES]: "easeia-backfill-heroes",
  [JobKind.BACKFILL_NETWORK]: "easeia-backfill-network",
  [JobKind.BACKFILL_REWRITE]: "easeia-backfill-rewrite",
  [JobKind.CLASSIFY]: "easeia-classify",
  [JobKind.CRAWL_GSC_LINKS]: "easeia-crawl-gsc-links",
  [JobKind.CRAWL_LINKS]: "easeia-crawl-links",
  [JobKind.CRAWL_MONEY_SITE]: "easeia-crawl-money-site",
  [JobKind.CRAWL_MONEY_SITE_PAGE]: "easeia-crawl-money-site-page",
  [JobKind.EMBED]: "easeia-embed",
  [JobKind.GENERATE_BODY_IMAGES]: "easeia-generate-body-images",
  [JobKind.GENERATE_IMAGE]: "easeia-generate-image",
  [JobKind.GENERATE_POST]: "easeia-generate-post",
  [JobKind.PUBLISH]: "easeia-publish",
  [JobKind.REAP_STUCK_JOBS]: "easeia-reap-stuck-jobs",
  [JobKind.REQUEST_SNAPSHOTS]: "easeia-request-snapshots",
  [JobKind.REWRITE_POST]: "easeia-rewrite-post",
  [JobKind.SNAPSHOT_SITE]: "easeia-snapshot-site",
  [JobKind.SUGGEST_LINKS]: "easeia-suggest-links",
  [JobKind.TRIGGER_DEPLOY]: "easeia-trigger-deploy",
} satisfies QueueNamesContract;

const queues = new Map<JobKind, Queue>();
export const queueFor = (kind: JobKind): Queue => {
  const cached = queues.get(kind);
  if (cached) {
    return cached;
  }
  const q = new Queue(QUEUE_NAMES[kind], {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { delay: 5000, type: "exponential" },
      removeOnComplete: { age: 60 * 60 * 24, count: 100 },
      removeOnFail: { age: 60 * 60 * 24 * 7, count: 500 },
    },
  });
  queues.set(kind, q);
  return q;
};

/**
 * Close every BullMQ Queue this process opened and quit the shared
 * Redis connection. Call from short-lived CLIs so Node can exit; the
 * long-running worker leaves these handles open by design.
 */
export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled([...queues.values()].map((q) => q.close()));
  queues.clear();
  if (connection) {
    await connection.quit().catch(() => undefined);
    connection = null;
  }
};

export const describeError = (cause: unknown): string =>
  cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);

type EnqueueInput<K extends JobKind = JobKind> = {
  delayMs?: number;
  kind: K;
  payload: JobPayloads[K];
  postId?: string;
  siteId?: string;
};

type EnqueuedJob = {
  id: string;
  queueJobId: string | undefined;
};

const rowFor = <K extends JobKind>(input: EnqueueInput<K>): Prisma.JobUncheckedCreateInput => ({
  kind: input.kind,
  payload: input.payload,
  postId: input.postId,
  siteId: input.siteId,
  status: JobStatus.QUEUED,
});

const push = async <K extends JobKind>(
  queue: Queue,
  jobId: string,
  input: EnqueueInput<K>,
): Promise<EnqueuedJob> => {
  const jobOptions: JobsOptions = { jobId };
  if (input.delayMs !== undefined && input.delayMs > 0) {
    jobOptions.delay = input.delayMs;
  }
  let queueJobId: string | undefined;
  try {
    const bullJob = await queue.add(input.kind.toLowerCase(), input.payload, jobOptions);
    queueJobId = bullJob.id;
  } catch (error) {
    await prisma.job.update({
      data: { finishedAt: new Date(), lastError: describeError(error), status: JobStatus.FAILED },
      where: { id: jobId },
    });
    throw error;
  }
  await prisma.job.update({ data: { queueJobId: queueJobId ?? null }, where: { id: jobId } });
  return { id: jobId, queueJobId };
};

export const enqueue = async <K extends JobKind>(input: EnqueueInput<K>): Promise<EnqueuedJob> => {
  const queue = queueFor(input.kind);
  const job = await prisma.job.create({ data: rowFor(input) });
  return push(queue, job.id, input);
};

const enqueueUnless =
  (blocking: Prisma.JobWhereInput) =>
  async <K extends JobKind>(input: EnqueueInput<K>): Promise<EnqueuedJob | null> => {
    const queue = queueFor(input.kind);
    const lockKey = `${input.kind}:${input.siteId ?? ""}`;
    const job = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      const busy = await tx.job.count({
        where: { ...blocking, kind: input.kind, siteId: input.siteId },
      });
      return busy > 0 ? null : tx.job.create({ data: rowFor(input) });
    });
    return job === null ? null : push(queue, job.id, input);
  };

export const enqueueUnlessInFlight = enqueueUnless(inFlight);

export const enqueueUnlessQueued = enqueueUnless({ status: JobStatus.QUEUED });

type ScheduleInput<K extends JobKind> = {
  everyMs: number;
  kind: K;
  payload: JobPayloads[K];
};

export const schedule = async <K extends JobKind>({
  everyMs,
  kind,
  payload,
}: ScheduleInput<K>): Promise<void> => {
  await queueFor(kind).upsertJobScheduler(
    kind,
    { every: everyMs },
    { data: payload, name: kind.toLowerCase() },
  );
};

export const unschedule = async (kind: JobKind): Promise<void> => {
  await queueFor(kind).removeJobScheduler(kind);
};

type CompletedJob<K extends JobKind> = Omit<EnqueueInput<K>, "delayMs"> & {
  finishedAt: Date;
  id: string;
};

export const recordCompletedJob = async <K extends JobKind>({
  finishedAt,
  id,
  ...input
}: CompletedJob<K>): Promise<void> => {
  const row = {
    ...rowFor(input),
    attempts: 1,
    createdAt: finishedAt,
    finishedAt,
    startedAt: finishedAt,
    status: JobStatus.DONE,
  };
  await prisma.job.upsert({ create: { id, ...row }, update: row, where: { id } });
};
