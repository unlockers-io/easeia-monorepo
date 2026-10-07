import type { JobKind, Prisma } from "@repo/db";

type BackfillGscLinksPayload = {
  cursor?: number;
  initialFanoutDone?: boolean;
  postIds?: ReadonlyArray<string>;
  siteId: string;
};

type JobPayloadMap<T extends Record<JobKind, Prisma.InputJsonObject>> = T;

type JobPayloads = JobPayloadMap<{
  BACKFILL_GSC_LINKS: BackfillGscLinksPayload;
  BACKFILL_NETWORK: {
    initialFanoutDone?: boolean;
    phase: "CLASSIFY_EMBED" | "SUGGEST_LINKS";
    startedAt: string;
  };
  BACKFILL_REWRITE: {
    force: boolean;
    initialFanoutDone?: boolean;
    initialPostsEligible: number;
    phase: "CRAWL_MONEY_SITE" | "REWRITE_POST";
    startedAt: string;
  };
  CLASSIFY: { postId: string };
  CRAWL_GSC_LINKS: { postId: string };
  CRAWL_LINKS: { postId: string };
  CRAWL_MONEY_SITE: { moneySiteId: string };
  CRAWL_MONEY_SITE_PAGE: { moneySitePageId: string };
  EMBED: { postId: string };
  GENERATE_BODY_IMAGES: { postId: string };
  GENERATE_IMAGE: { postId: string };
  GENERATE_POST: { siteId: string };
  PUBLISH: { postId: string };
  REWRITE_POST: { force?: boolean; postId: string };
  SNAPSHOT_SITE: { siteId: string };
  SUGGEST_LINKS: { postId: string };
  TRIGGER_DEPLOY: { siteId: string };
}>;

/**
 * Read-side boundary for Job.payload. `enqueue` is the only writer and
 * its input is typed per kind, so the stored JSON matches JobPayloads[K];
 * this is the single place that assertion lives.
 */
const getJobPayload = <K extends JobKind>(_kind: K, payload: Prisma.JsonValue): JobPayloads[K] =>
  // SAFETY: enqueue is the only writer and statically binds each payload to its JobKind.
  // oxlint-disable-next-line no-unsafe-type-assertion -- Prisma types the stored JSON as JsonValue
  payload as JobPayloads[K];

export { getJobPayload };
export type { BackfillGscLinksPayload, JobPayloads };
