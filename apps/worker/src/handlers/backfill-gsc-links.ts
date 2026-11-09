import { JobKind, type Prisma, prisma } from "@repo/db";
import { enqueue, type ConsumerContext } from "@repo/jobs";
import { createJobLogger } from "@repo/observability/worker";
import { forSite } from "@repo/search-console";

// Google's URL Inspection API allows ~600 calls/property/day; 500 is the
// conservative ceiling this stagger is derived from.
const REQUESTS_PER_DAY = 500;
const STAGGER_MS = Math.ceil(86_400 / REQUESTS_PER_DAY) * 1000;

const BATCH_SIZE = 50;

// Derived, not chosen: a tick enqueues BATCH_SIZE jobs spaced STAGGER_MS apart
// with delays restarting at 0, so ticking any faster than the batch's own span
// puts multiple batches in flight and multiplies the effective request rate.
const TICK_DELAY_MS = BATCH_SIZE * STAGGER_MS;

type Payload = ConsumerContext<"BACKFILL_GSC_LINKS">["payload"];

const reEnqueueSelf = async (
  payload: Payload,
  delayMs: number,
  tx?: Prisma.TransactionClient,
): Promise<void> => {
  await enqueue({ delayMs, kind: JobKind.BACKFILL_GSC_LINKS, payload, siteId: payload.siteId }, tx);
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

    const searchConsole = await forSite(site.domain);

    if (searchConsole.status === "not_connected") {
      log.warn("backfill-gsc-links: no Google connection, aborting");
      log.emit();

      return;
    }

    if (searchConsole.status === "not_verified") {
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

    log.set({ posts: posts.length, sitePropertyUrl: searchConsole.property });
    log.info("backfill-gsc-links: initial fanout");
    log.emit();

    await reEnqueueSelf(
      {
        cursor: 0,
        initialFanoutDone: true,
        postIds: posts.map((p) => p.id),
        siteId: site.id,
      },
      0,
    );

    return;
  }

  const postIds = payload.postIds ?? [];
  const cursor = payload.cursor ?? 0;

  const slice = postIds.slice(cursor, cursor + BATCH_SIZE);

  if (slice.length === 0) {
    log.set({ cursor, postIds: postIds.length });
    log.info("backfill-gsc-links: complete");
    log.emit();

    return;
  }

  const resumeAt = cursor + slice.length;

  await prisma.$transaction(async (tx) => {
    for (const [i, postId] of slice.entries()) {
      await enqueue(
        { delayMs: i * STAGGER_MS, kind: JobKind.CRAWL_GSC_LINKS, payload: { postId }, postId },
        tx,
      );
    }

    await reEnqueueSelf(
      { cursor: resumeAt, initialFanoutDone: true, postIds, siteId: payload.siteId },
      TICK_DELAY_MS,
      tx,
    );
  });

  log.set({ cursor, enqueued: slice.length, next: resumeAt, total: postIds.length });
  log.info("backfill-gsc-links: batch enqueued");
  log.emit();
};
