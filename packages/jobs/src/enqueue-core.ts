import { JobKind, JobStatus, prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

import type { JobPayloads } from "./payloads";

let cachedRedis: Redis | null = null;
export const getRedis = (url: string): Redis => {
  if (cachedRedis) {
    return cachedRedis;
  }
  cachedRedis = new Redis(url, { maxRetriesPerRequest: null });
  return cachedRedis;
};

type QueueNamesContract = Record<JobKind, string>;

export const QUEUE_NAMES = {
  [JobKind.BACKFILL_GSC_LINKS]: "easeia-backfill-gsc-links",
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
  [JobKind.REWRITE_POST]: "easeia-rewrite-post",
  [JobKind.SNAPSHOT_SITE]: "easeia-snapshot-site",
  [JobKind.SUGGEST_LINKS]: "easeia-suggest-links",
  [JobKind.TRIGGER_DEPLOY]: "easeia-trigger-deploy",
} satisfies QueueNamesContract;

const queues = new Map<JobKind, Queue>();
const queueFor = (kind: JobKind, redisUrl: string): Queue => {
  const cached = queues.get(kind);
  if (cached) {
    return cached;
  }
  const q = new Queue(QUEUE_NAMES[kind], {
    connection: getRedis(redisUrl),
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

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled([...queues.values()].map((q) => q.close()));
  queues.clear();
  if (cachedRedis) {
    await cachedRedis.quit().catch(() => undefined);
    cachedRedis = null;
  }
};

export type EnqueueInput<K extends JobKind = JobKind> = {
  delayMs?: number;
  kind: K;
  payload: JobPayloads[K];
  postId?: string;
  redisUrl: string;
  siteId?: string;
};

export type EnqueuedJob = {
  id: string;
  queueJobId: string | undefined;
};

export const enqueue = async <K extends JobKind>(input: EnqueueInput<K>): Promise<EnqueuedJob> => {
  const payloadJson: Prisma.InputJsonObject = input.payload;
  const job = await prisma.job.create({
    data: {
      kind: input.kind,
      payload: payloadJson,
      postId: input.postId,
      siteId: input.siteId,
      status: JobStatus.QUEUED,
    },
  });
  const queue = queueFor(input.kind, input.redisUrl);
  const jobOptions: JobsOptions = { jobId: job.id };
  if (input.delayMs !== undefined && input.delayMs > 0) {
    jobOptions.delay = input.delayMs;
  }
  const bullJob = await queue.add(
    input.kind.toLowerCase(),
    { jobId: job.id, ...payloadJson },
    jobOptions,
  );
  await prisma.job.update({
    data: { queueJobId: bullJob.id ?? null },
    where: { id: job.id },
  });
  return { id: job.id, queueJobId: bullJob.id };
};
