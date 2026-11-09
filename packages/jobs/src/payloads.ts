import type { JobKind, Prisma } from "@repo/db";
import { z } from "zod";

const tick = z.record(z.string(), z.never());
const postTarget = z.object({ postId: z.string() });
const siteTarget = z.object({ siteId: z.string() });

const backfillGscLinksPayload = z.object({
  cursor: z.number().optional(),
  initialFanoutDone: z.boolean().optional(),
  postIds: z.array(z.string()).readonly().optional(),
  siteId: z.string(),
});

const jobPayloadSchemas = {
  AUDIT_SLUG_DRIFT: tick,
  AUTO_PUBLISH: tick,
  BACKFILL_GSC_LINKS: backfillGscLinksPayload,
  BACKFILL_HEROES: tick,
  CLASSIFY: postTarget,
  CRAWL_GSC_LINKS: postTarget,
  CRAWL_LINKS: postTarget,
  CRAWL_MONEY_SITE: z.object({ moneySiteId: z.string() }),
  CRAWL_MONEY_SITE_PAGE: z.object({ moneySitePageId: z.string() }),
  EMBED: postTarget,
  GENERATE_BODY_IMAGES: postTarget,
  GENERATE_IMAGE: postTarget,
  GENERATE_POST: siteTarget,
  PUBLISH: postTarget,
  REAP_STUCK_JOBS: tick,
  REQUEST_SNAPSHOTS: tick,
  REWRITE_POST: z.object({ force: z.boolean().optional(), postId: z.string() }),
  SNAPSHOT_SITE: siteTarget,
  SUGGEST_LINKS: postTarget,
  TRIGGER_DEPLOY: siteTarget,
} satisfies Record<JobKind, z.ZodType<Prisma.InputJsonObject>>;

export type JobPayloads = { [K in JobKind]: z.infer<(typeof jobPayloadSchemas)[K]> };

const payloadSchemas: { [K in JobKind]: z.ZodType<JobPayloads[K]> } = jobPayloadSchemas;

export const parsePayload = <K extends JobKind>(
  kind: K,
  payload: Prisma.InputJsonValue | Prisma.JsonValue,
): JobPayloads[K] => payloadSchemas[kind].parse(payload);
