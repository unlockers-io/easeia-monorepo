import "zod/compile";
import "dotenv/config";

import { networkBackfill, rewriteBackfill } from "@repo/backfill";
import { prisma } from "@repo/db";
import {
  consume,
  dispatchPendingJobs,
  type ConsumerContext,
  JobKind,
  reapStuckJobs,
  schedule,
  unschedule,
} from "@repo/jobs";
import { initWorkerLogger } from "@repo/observability/worker";
import * as Sites from "@repo/sites";
import type { Worker } from "bullmq";

import { handleAutoPublish } from "./handlers/auto-publish";
import { handleBackfillGscLinks } from "./handlers/backfill-gsc-links";
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
import { isRetryable, skipOptionalAiWhenUnconfigured } from "./lib/ai-unavailable";
import { env } from "./lib/env";
import { backfillHeroes } from "./lib/hero-backfill-fanout";
import { log } from "./lib/logger";
import { auditSlugDrift } from "./lib/slug-drift-audit";

initWorkerLogger({ service: "worker" });

const SERIAL = 1;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const STUCK_AFTER_MS = 2 * HOUR_MS;

const startConsumer = <K extends JobKind>(
  kind: K,
  handler: (ctx: ConsumerContext<K>) => Promise<void>,
  concurrency: number = env.WORKER_CONCURRENCY,
): Worker =>
  consume({
    concurrency,
    handler: skipOptionalAiWhenUnconfigured(kind, handler),
    isRetryable,
    kind,
  });

type ConsumersContract = Record<JobKind, () => Worker>;

const reapStuck = async (): Promise<void> => {
  const { reaped } = await reapStuckJobs(STUCK_AFTER_MS);
  if (reaped > 0) {
    log.warn({ message: "reaped stuck jobs", reaped });
  }
};

const requestSnapshots = async (): Promise<void> => {
  const { queued } = await Sites.requestSnapshots();
  log.info({ message: "snapshots requested", queued });
};

const CONSUMERS = {
  [JobKind.AUDIT_SLUG_DRIFT]: () =>
    startConsumer(
      JobKind.AUDIT_SLUG_DRIFT,
      async () => {
        await auditSlugDrift();
      },
      SERIAL,
    ),
  [JobKind.AUTO_PUBLISH]: () => startConsumer(JobKind.AUTO_PUBLISH, handleAutoPublish, SERIAL),
  [JobKind.BACKFILL_GSC_LINKS]: () =>
    startConsumer(JobKind.BACKFILL_GSC_LINKS, handleBackfillGscLinks, SERIAL),
  [JobKind.BACKFILL_HEROES]: () =>
    startConsumer(
      JobKind.BACKFILL_HEROES,
      async () => {
        await backfillHeroes();
      },
      SERIAL,
    ),
  [JobKind.BACKFILL_NETWORK]: () =>
    startConsumer(JobKind.BACKFILL_NETWORK, networkBackfill.tick, SERIAL),
  [JobKind.BACKFILL_REWRITE]: () =>
    startConsumer(JobKind.BACKFILL_REWRITE, rewriteBackfill.tick, SERIAL),
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
  [JobKind.REAP_STUCK_JOBS]: () => startConsumer(JobKind.REAP_STUCK_JOBS, reapStuck, SERIAL),
  [JobKind.REQUEST_SNAPSHOTS]: () =>
    startConsumer(JobKind.REQUEST_SNAPSHOTS, requestSnapshots, SERIAL),
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

const TICKS = [
  { enabled: true, everyMs: 10 * MINUTE_MS, kind: JobKind.REAP_STUCK_JOBS },
  { enabled: true, everyMs: 6 * HOUR_MS, kind: JobKind.REQUEST_SNAPSHOTS },
  { enabled: true, everyMs: HOUR_MS, kind: JobKind.AUTO_PUBLISH },
  { enabled: env.HERO_AUTOGEN_ENABLED, everyMs: HOUR_MS, kind: JobKind.BACKFILL_HEROES },
  { enabled: true, everyMs: 24 * HOUR_MS, kind: JobKind.AUDIT_SLUG_DRIFT },
] as const;

await Promise.all(
  TICKS.map(({ enabled, everyMs, kind }) =>
    enabled ? schedule({ everyMs, kind, payload: {} }) : unschedule(kind),
  ),
);

let dispatching: Promise<void> | undefined;
const dispatch = () => {
  if (dispatching !== undefined) {
    return;
  }
  dispatching = (async () => {
    try {
      await Promise.all([networkBackfill.tick(), rewriteBackfill.tick()]);
      await dispatchPendingJobs();
    } catch (error) {
      log.error({ err: error, message: "durable job dispatch failed" });
    } finally {
      dispatching = undefined;
    }
  })();
};
dispatch();
const dispatchTimer = setInterval(dispatch, 1000);

const shutdown = async (signal: string) => {
  log.info({ message: "shutting down workers", signal });
  clearInterval(dispatchTimer);
  await dispatching;
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
