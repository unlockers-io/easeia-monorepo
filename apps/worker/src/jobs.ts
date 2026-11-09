import { TICK_EVERY_MS as AUTO_PUBLISH_EVERY_MS } from "@repo/auto-publish";
import { forPublishedMember } from "@repo/backfill";
import { type Job, JobKind } from "@repo/db";
import type { ConsumerContext } from "@repo/jobs";
import { parsePayload } from "@repo/jobs/worker";
import { log } from "@repo/observability";

import { handleAuditSlugDrift } from "./handlers/audit-slug-drift";
import { handleAutoPublish } from "./handlers/auto-publish";
import { handleBackfillGscLinks } from "./handlers/backfill-gsc-links";
import { handleBackfillHeroes } from "./handlers/backfill-heroes";
import { handleClassify } from "./handlers/classify";
import { handleCrawlGscLinks } from "./handlers/crawl-gsc-links";
import { handleCrawlLinks } from "./handlers/crawl-links";
import { handleCrawlMoneySite } from "./handlers/crawl-money-site";
import { handleCrawlMoneySitePage } from "./handlers/crawl-money-site-page";
import { handleEmbed } from "./handlers/embed";
import { handleGenerateBodyImages } from "./handlers/generate-body-images";
import { handleGenerateImage } from "./handlers/generate-image";
import { handleGeneratePost } from "./handlers/generate-post";
import { failPublish, handlePublish } from "./handlers/publish";
import { handleReapStuckJobs } from "./handlers/reap-stuck-jobs";
import { handleRequestSnapshots } from "./handlers/request-snapshots";
import { handleRewritePost } from "./handlers/rewrite-post";
import { handleSnapshotSite } from "./handlers/snapshot-site";
import { handleSuggestLinks } from "./handlers/suggest-links";
import { handleTriggerDeploy } from "./handlers/trigger-deploy";
import { skipWhenAiUnconfigured } from "./lib/ai-unavailable";
import { env } from "./lib/env";

const HOUR_MS = 60 * 60 * 1000;

type Handler<K extends JobKind> = (ctx: ConsumerContext<K>) => Promise<void>;

type JobDefinition<K extends JobKind> = {
  aiOptional?: true;
  handle: Handler<K>;
  serial?: true;
  tick?: { enabled?: boolean; everyMs: number };
};

const loggingFailures =
  <K extends JobKind>(onFailure: Handler<K>): Handler<K> =>
  async (ctx) => {
    try {
      await onFailure(ctx);
    } catch (error) {
      log.error({ err: error, jobId: ctx.jobId, message: "job failure handler failed" });
    }
  };

const FAILURES: { [K in JobKind]?: Handler<K> } = { PUBLISH: failPublish };

const failureOf = <K extends JobKind>(kind: K): Handler<K> | undefined => {
  const onFailure = FAILURES[kind];

  return onFailure === undefined ? undefined : loggingFailures(onFailure);
};

const failReaped = async (job: Job): Promise<void> => {
  await failureOf(job.kind)?.({ jobId: job.id, payload: parsePayload(job.kind, job.payload) });
};

const JOBS: { [K in JobKind]: JobDefinition<K> } = {
  AUDIT_SLUG_DRIFT: { handle: handleAuditSlugDrift, serial: true, tick: { everyMs: 24 * HOUR_MS } },
  AUTO_PUBLISH: {
    handle: handleAutoPublish,
    serial: true,
    tick: { everyMs: AUTO_PUBLISH_EVERY_MS },
  },
  BACKFILL_GSC_LINKS: { handle: handleBackfillGscLinks, serial: true },
  BACKFILL_HEROES: {
    handle: handleBackfillHeroes,
    serial: true,
    tick: { enabled: env.HERO_AUTOGEN_ENABLED, everyMs: HOUR_MS },
  },
  CLASSIFY: { aiOptional: true, handle: handleClassify },
  CRAWL_GSC_LINKS: { handle: handleCrawlGscLinks, serial: true },
  CRAWL_LINKS: { handle: handleCrawlLinks },
  CRAWL_MONEY_SITE: { handle: handleCrawlMoneySite },
  CRAWL_MONEY_SITE_PAGE: { handle: handleCrawlMoneySitePage },
  EMBED: { aiOptional: true, handle: handleEmbed },
  GENERATE_BODY_IMAGES: { aiOptional: true, handle: handleGenerateBodyImages },
  GENERATE_IMAGE: { aiOptional: true, handle: handleGenerateImage },
  GENERATE_POST: { handle: handleGeneratePost, serial: true },
  PUBLISH: { handle: handlePublish },
  REAP_STUCK_JOBS: {
    handle: () => handleReapStuckJobs(failReaped),
    serial: true,
    tick: { everyMs: HOUR_MS / 6 },
  },
  REQUEST_SNAPSHOTS: {
    handle: handleRequestSnapshots,
    serial: true,
    tick: { everyMs: 6 * HOUR_MS },
  },
  REWRITE_POST: { handle: handleRewritePost },
  SNAPSHOT_SITE: { handle: handleSnapshotSite },
  SUGGEST_LINKS: { handle: handleSuggestLinks },
  TRIGGER_DEPLOY: { handle: handleTriggerDeploy },
};

export type JobRegistration<K extends JobKind = JobKind> = {
  concurrency: number;
  handle: Handler<K>;
  kind: K;
  onFailure?: Handler<K>;
  tick?: { enabled: boolean; everyMs: number };
};

const scheduleOf = (tick: JobDefinition<JobKind>["tick"]): JobRegistration["tick"] =>
  tick === undefined ? undefined : { enabled: tick.enabled ?? true, everyMs: tick.everyMs };

const register = <K extends JobKind>(kind: K): JobRegistration<K> => {
  const { aiOptional, handle, serial, tick } = JOBS[kind];
  const published = forPublishedMember(handle);

  return {
    concurrency: serial ? 1 : env.WORKER_CONCURRENCY,
    handle: aiOptional ? skipWhenAiUnconfigured(published) : published,
    kind,
    onFailure: failureOf(kind),
    tick: scheduleOf(tick),
  };
};

export const registrations = (): Array<JobRegistration> =>
  Object.values(JobKind).map((kind) => register(kind));
