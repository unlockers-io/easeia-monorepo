import type { JobKind } from "@repo/db";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const JOB_ATTEMPTS = 5;

export const queueName = (kind: JobKind): string =>
  `easeia-${kind.toLowerCase().replaceAll("_", "-")}`;

export const jobName = (kind: JobKind): string => kind.toLowerCase();

export const describeError = (cause: unknown): string =>
  cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);

let connection: Redis | null = null;

export const redisConnection = (): Redis => {
  if (connection) {
    return connection;
  }

  const url = process.env.REDIS_URL;

  if (url === undefined || url === "") {
    throw new Error("REDIS_URL is required to dispatch or consume Jobs");
  }

  connection = new Redis(url, { maxRetriesPerRequest: null });

  return connection;
};

const queues = new Map<JobKind, Queue>();

export const queueFor = (kind: JobKind): Queue => {
  const cached = queues.get(kind);

  if (cached) {
    return cached;
  }

  const q = new Queue(queueName(kind), {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: JOB_ATTEMPTS,
      backoff: { delay: 5000, type: "exponential" },
      removeOnComplete: { age: 60 * 60 * 24, count: 100 },
      removeOnFail: { age: 60 * 60 * 24 * 7, count: 500 },
    },
  });

  queues.set(kind, q);

  return q;
};

export const closeJobs = async (): Promise<void> => {
  await Promise.allSettled([...queues.values()].map((q) => q.close()));
  queues.clear();

  if (connection) {
    await connection.quit().catch(() => undefined);
    connection = null;
  }
};

export const schedule = async (kind: JobKind, everyMs: number): Promise<void> => {
  await queueFor(kind).upsertJobScheduler(
    kind,
    { every: everyMs },
    { data: {}, name: jobName(kind) },
  );
};

export const unschedule = async (kind: JobKind): Promise<void> => {
  await queueFor(kind).removeJobScheduler(kind);
};
