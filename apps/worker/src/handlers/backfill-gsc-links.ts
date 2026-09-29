import { JobKind, prisma } from "@repo/db";
import {
  asLoggableError,
  enqueue,
  fanoutRejections,
  type BackfillGscLinksPayload,
  type ConsumerContext,
} from "@repo/jobs";
import { GoogleNotConnectedError, resolveSiteUrl } from "@repo/search-console";

import { env } from "../lib/env";
import { buildRedirectUri } from "../lib/google-redirect-uri";
import { createJobLogger } from "../lib/logger";

import { sliceBatch } from "./slice-batch";

// Google's URL Inspection API allows ~600 calls/property/day; 500 is the
// conservative ceiling this stagger is derived from.
const REQUESTS_PER_DAY = 500;
const STAGGER_MS = Math.ceil(86_400 / REQUESTS_PER_DAY) * 1000;

const BATCH_SIZE = 50;
// Derived, not chosen: a tick enqueues BATCH_SIZE jobs spaced STAGGER_MS apart
// with delays restarting at 0, so ticking any faster than the batch's own span
// puts multiple batches in flight and multiplies the effective request rate.
const TICK_DELAY_MS = BATCH_SIZE * STAGGER_MS;

const reEnqueueSelf = async (payload: BackfillGscLinksPayload, delayMs: number): Promise<void> => {
  await enqueue({
    delayMs,
    kind: JobKind.BACKFILL_GSC_LINKS,
    payload,
    redisUrl: env.REDIS_URL,
    siteId: payload.siteId,
  });
};

export const handleBackfillGscLinks = async (
  ctx: ConsumerContext<"BACKFILL_GSC_LINKS">,
): Promise<void> => {
  const { jobId, payload } = ctx;
  const log = createJobLogger({ jobId, queue: "backfill-gsc-links" });
  log.set({ siteId: payload.siteId });

  if (payload.initialFanoutDone !== true) {
    const site = await prisma.site.findUnique({
      select: { domain: true, id: true },
      where: { id: payload.siteId },
    });
    if (!site) {
      log.warn("backfill-gsc-links: site not found");
      log.emit();
      return;
    }

    const redirectUri = buildRedirectUri();
    if (redirectUri === null || redirectUri === "") {
      log.warn("backfill-gsc-links: APP_URL unset, aborting");
      log.emit();
      return;
    }

    let sitePropertyUrl: string | null;
    try {
      sitePropertyUrl = await resolveSiteUrl({ redirectUri, userId: payload.userId }, site.domain);
    } catch (error) {
      if (error instanceof GoogleNotConnectedError) {
        log.set({ userId: payload.userId });
        log.warn("backfill-gsc-links: user has no Google connection, aborting");
        log.emit();
        return;
      }
      throw error;
    }
    if (sitePropertyUrl === null || sitePropertyUrl === "") {
      log.set({ domain: site.domain });
      log.warn("backfill-gsc-links: domain not verified in GSC, aborting");
      log.emit();
      return;
    }

    const posts = await prisma.post.findMany({
      orderBy: { publishedAt: "desc" },
      select: { id: true },
      where: {
        siteId: site.id,
        status: "PUBLISHED",
      },
    });

    log.set({ posts: posts.length, sitePropertyUrl });
    log.info("backfill-gsc-links: initial fanout");
    log.emit();

    await reEnqueueSelf(
      {
        cursor: 0,
        initialFanoutDone: true,
        postIds: posts.map((p) => p.id),
        siteId: site.id,
        sitePropertyUrl,
        userId: payload.userId,
      },
      0,
    );
    return;
  }

  const postIds = payload.postIds ?? [];
  const cursor = payload.cursor ?? 0;
  const sitePropertyUrl = payload.sitePropertyUrl;
  if (sitePropertyUrl === undefined || sitePropertyUrl === "") {
    log.warn("backfill-gsc-links: missing sitePropertyUrl, aborting");
    log.emit();
    return;
  }

  const { slice } = sliceBatch(postIds, cursor);
  if (slice.length === 0) {
    log.set({ cursor, postIds: postIds.length });
    log.info("backfill-gsc-links: complete");
    log.emit();
    return;
  }

  const settled = await Promise.allSettled(
    slice.map((postId, i) =>
      enqueue({
        delayMs: i * STAGGER_MS,
        kind: JobKind.CRAWL_GSC_LINKS,
        payload: { postId, sitePropertyUrl, userId: payload.userId },
        postId,
        redisUrl: env.REDIS_URL,
      }),
    ),
  );

  for (const rejection of fanoutRejections(settled)) {
    log.error(asLoggableError(rejection.reason), { enqueueFailedFor: slice[rejection.index] });
  }

  // progress record and nothing re-enqueues a dropped job, so skipping past a
  // failure means those posts are never inspected: `enqueue` writes the Job row
  // before pushing to BullMQ, and the reaper only reclaims RUNNING rows, so the
  // loss leaves no trace anywhere. Re-running the ids after the failure is the
  // cheaper mistake, and CRAWL_GSC_LINKS upserts, so duplicates converge.
  const firstFailure = settled.findIndex((r) => r.status === "rejected");
  const enqueued = firstFailure === -1 ? slice.length : firstFailure;
  const resumeAt = cursor + enqueued;

  log.set({
    cursor,
    enqueued,
    next: resumeAt,
    requested: slice.length,
    total: postIds.length,
  });
  log.info("backfill-gsc-links: batch enqueued");
  log.emit();

  await reEnqueueSelf(
    {
      cursor: resumeAt,
      initialFanoutDone: true,
      postIds,
      siteId: payload.siteId,
      sitePropertyUrl,
      userId: payload.userId,
    },
    TICK_DELAY_MS,
  );
};
