import "zod/compile";
import "dotenv/config";

import { prisma } from "@repo/db";
import { consume, type ConsumerContext, JobKind, reapStuckJobs } from "@repo/jobs";
import { initWorkerLogger } from "@repo/observability/worker";
import type { Worker } from "bullmq";

import { handleBackfillGscLinks } from "./handlers/backfill-gsc-links";
import { handleBackfillNetwork } from "./handlers/backfill-network";
import { handleBackfillRewrite } from "./handlers/backfill-rewrite";
import { handleClassify } from "./handlers/classify";
import { handleCrawlGscLinks } from "./handlers/crawl-gsc-links";
import { handleCrawlLinks } from "./handlers/crawl-links";
import { handleCrawlMoneySite } from "./handlers/crawl-money-site";
import { handleCrawlMoneySitePage } from "./handlers/crawl-money-site-page";
import { handleEmbed } from "./handlers/embed";
import { handleGenerateBodyImages } from "./handlers/generate-body-images";
import { handleGenerateImage } from "./handlers/generate-image";
import { handleGeneratePost } from "./handlers/generate-post";
import { handlePublish } from "./handlers/publish";
import { handleRewritePost } from "./handlers/rewrite-post";
import { handleSnapshotSite } from "./handlers/snapshot-site";
import { handleSuggestLinks } from "./handlers/suggest-links";
import { handleTriggerDeploy } from "./handlers/trigger-deploy";
import { env } from "./lib/env";
import { backfillHeroes } from "./lib/hero-backfill-fanout";
import { log } from "./lib/logger";
import { publishDueFromBuckets, refillLowBuckets } from "./lib/scheduler-fanout";
import { auditSlugDrift } from "./lib/slug-drift-audit";
import { enqueueSnapshots } from "./lib/snapshot-fanout";

initWorkerLogger({ service: "worker" });

const SERIAL = 1;

const startConsumer = <K extends JobKind>(
  kind: K,
  handler: (ctx: ConsumerContext<K>) => Promise<void>,
  concurrency: number = env.WORKER_CONCURRENCY,
): Worker => consume({ concurrency, handler, kind, redisUrl: env.REDIS_URL });

type ConsumersContract = Record<JobKind, () => Worker>;

const CONSUMERS = {
  [JobKind.BACKFILL_GSC_LINKS]: () =>
    startConsumer(JobKind.BACKFILL_GSC_LINKS, handleBackfillGscLinks, SERIAL),
  [JobKind.BACKFILL_NETWORK]: () =>
    startConsumer(JobKind.BACKFILL_NETWORK, handleBackfillNetwork, SERIAL),
  [JobKind.BACKFILL_REWRITE]: () =>
    startConsumer(JobKind.BACKFILL_REWRITE, handleBackfillRewrite, SERIAL),
  [JobKind.CLASSIFY]: () => startConsumer(JobKind.CLASSIFY, handleClassify),
  [JobKind.CRAWL_GSC_LINKS]: () =>
    startConsumer(JobKind.CRAWL_GSC_LINKS, handleCrawlGscLinks, SERIAL),
  [JobKind.CRAWL_LINKS]: () => startConsumer(JobKind.CRAWL_LINKS, handleCrawlLinks),
  [JobKind.CRAWL_MONEY_SITE]: () => startConsumer(JobKind.CRAWL_MONEY_SITE, handleCrawlMoneySite),
  [JobKind.CRAWL_MONEY_SITE_PAGE]: () =>
    startConsumer(JobKind.CRAWL_MONEY_SITE_PAGE, handleCrawlMoneySitePage),
  [JobKind.EMBED]: () => startConsumer(JobKind.EMBED, handleEmbed),
  [JobKind.GENERATE_BODY_IMAGES]: () =>
    startConsumer(JobKind.GENERATE_BODY_IMAGES, handleGenerateBodyImages),
  [JobKind.GENERATE_IMAGE]: () => startConsumer(JobKind.GENERATE_IMAGE, handleGenerateImage),
  [JobKind.GENERATE_POST]: () => startConsumer(JobKind.GENERATE_POST, handleGeneratePost, SERIAL),
  [JobKind.PUBLISH]: () => startConsumer(JobKind.PUBLISH, handlePublish),
  [JobKind.REWRITE_POST]: () => startConsumer(JobKind.REWRITE_POST, handleRewritePost),
  [JobKind.SNAPSHOT_SITE]: () => startConsumer(JobKind.SNAPSHOT_SITE, handleSnapshotSite),
  [JobKind.SUGGEST_LINKS]: () => startConsumer(JobKind.SUGGEST_LINKS, handleSuggestLinks),
  [JobKind.TRIGGER_DEPLOY]: () => startConsumer(JobKind.TRIGGER_DEPLOY, handleTriggerDeploy),
} satisfies ConsumersContract;

const workers: Array<Worker> = Object.values(CONSUMERS).map((start) => start());

for (const w of workers) {
  w.on("ready", () => {
    log.info({ message: "worker ready", queue: w.name });
  });
  w.on("failed", (job, err) => {
    log.error({
      err,
      errMessage: err.message,
      errName: err.name,
      jobId: job?.id,
      message: "job failed",
      queue: w.name,
    });
  });
  w.on("completed", (job) => {
    log.info({ jobId: job.id, message: "job completed", queue: w.name });
  });
}

log.info({ env: env.NODE_ENV, message: "🚀 Worker started", queues: workers.map((w) => w.name) });

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

type ScheduledStep = {
  onError: string;
  run: () => Promise<void>;
};

type ScheduledTask = {
  intervalMs: number;
  isEnabled?: () => boolean;
  runOnBoot: boolean;
  steps: ReadonlyArray<ScheduledStep>;
};

const SCHEDULED_TASKS: ReadonlyArray<ScheduledTask> = [
  {
    intervalMs: 10 * MINUTE_MS,
    runOnBoot: false,
    steps: [
      {
        onError: "reconcile failed",
        run: async () => {
          const res = await reapStuckJobs(2 * HOUR_MS);
          if (res.reaped > 0) {
            log.warn({ message: "reaped stuck jobs", reaped: res.reaped });
          }
        },
      },
    ],
  },
  {
    intervalMs: 6 * HOUR_MS,
    runOnBoot: true,
    steps: [
      {
        onError: "snapshot-fanout: failed",
        run: async () => {
          await enqueueSnapshots(env.REDIS_URL);
        },
      },
    ],
  },
  {
    intervalMs: HOUR_MS,
    runOnBoot: true,
    steps: [
      {
        onError: "scheduler: publish-from-bucket failed",
        run: async () => {
          await publishDueFromBuckets(env.REDIS_URL);
        },
      },
      {
        onError: "scheduler: refill failed",
        run: async () => {
          await refillLowBuckets(env.REDIS_URL);
        },
      },
    ],
  },
  {
    intervalMs: HOUR_MS,
    isEnabled: () => env.HERO_AUTOGEN_ENABLED,
    runOnBoot: true,
    steps: [
      {
        onError: "hero-backfill: failed",
        run: async () => {
          await backfillHeroes(env.REDIS_URL);
        },
      },
    ],
  },
  {
    intervalMs: 24 * HOUR_MS,
    runOnBoot: true,
    steps: [
      {
        onError: "slug-drift: audit failed",
        run: async () => {
          await auditSlugDrift();
        },
      },
    ],
  },
];

const runTask = (task: ScheduledTask): void => {
  if (task.isEnabled !== undefined && !task.isEnabled()) {
    return;
  }
  void (async () => {
    for (const step of task.steps) {
      try {
        await step.run();
      } catch (error) {
        log.error({ err: error, message: step.onError });
      }
    }
  })();
};

const timers = SCHEDULED_TASKS.map((task) => {
  const timer = setInterval(() => {
    runTask(task);
  }, task.intervalMs);
  if (task.runOnBoot) {
    runTask(task);
  }
  return timer;
});

const shutdown = async (signal: string) => {
  log.info({ message: "shutting down workers", signal });
  for (const timer of timers) {
    clearInterval(timer);
  }
  await Promise.allSettled(workers.map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
};

let shuttingDown: Promise<void> | undefined;
const requestShutdown = (signal: string): void => {
  shuttingDown ??= shutdown(signal);
  void shuttingDown;
};

process.on("SIGTERM", () => {
  requestShutdown("SIGTERM");
});
process.on("SIGINT", () => {
  requestShutdown("SIGINT");
});
