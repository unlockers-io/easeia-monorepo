import { assertAiConfigured } from "@repo/ai";
import { JobKind, type Prisma, prisma, type Site } from "@repo/db";
import { countInFlightBySite, enqueue, lockJobs } from "@repo/jobs";
import { bucketDraftWhere } from "@repo/posts";
import * as Sites from "@repo/sites";

import { isDue, nextDueAt } from "./rules";

const REFILL_CEILING = 20;
const LISTED_DRAFTS = 10;

type Supply = { drafts: number; inflight: number; total: number };

type BucketFields = Pick<Site, "bucketRefillAt" | "bucketTarget">;

type RefillSite = BucketFields & Pick<Site, "domain" | "id">;

export type Refill = { domain: string; queued: number; siteId: string; supply: Supply };

const supplyBySite = async (
  siteIds: ReadonlyArray<string>,
  tx: Prisma.TransactionClient = prisma,
): Promise<Map<string, Supply>> => {
  const [drafts, inflight] = await Promise.all([
    tx.post.groupBy({
      _count: { id: true },
      by: ["siteId"],
      where: { ...bucketDraftWhere, siteId: { in: [...siteIds] } },
    }),
    countInFlightBySite(JobKind.GENERATE_POST, siteIds, tx),
  ]);

  const draftsBySite = new Map(drafts.map((row) => [row.siteId, row._count.id]));

  return new Map(
    siteIds.map((siteId) => {
      const draftCount = draftsBySite.get(siteId) ?? 0;
      const inflightCount = inflight.get(siteId) ?? 0;

      return [
        siteId,
        { drafts: draftCount, inflight: inflightCount, total: draftCount + inflightCount },
      ];
    }),
  );
};

const supplyOf = (supplies: ReadonlyMap<string, Supply>, siteId: string): Supply =>
  supplies.get(siteId) ?? { drafts: 0, inflight: 0, total: 0 };

const refillCount = ({ bucketRefillAt, bucketTarget }: BucketFields, supply: Supply): number =>
  bucketRefillAt === null || bucketTarget === null || supply.total >= bucketRefillAt
    ? 0
    : Math.min(Math.max(0, bucketTarget - supply.total), REFILL_CEILING);

const refillSite = (site: RefillSite): Promise<Refill> =>
  prisma.$transaction(async (tx) => {
    await lockJobs(JobKind.GENERATE_POST, site.id, tx);
    const supply = supplyOf(await supplyBySite([site.id], tx), site.id);
    const queued = refillCount(site, supply);

    if (queued > 0) {
      assertAiConfigured();
    }

    for (let i = 0; i < queued; i += 1) {
      await enqueue(
        { kind: JobKind.GENERATE_POST, payload: { siteId: site.id }, siteId: site.id },
        tx,
      );
    }

    return { domain: site.domain, queued, siteId: site.id, supply };
  });

const REFILL_SELECT = {
  bucketRefillAt: true,
  bucketTarget: true,
  domain: true,
  id: true,
} satisfies Prisma.SiteSelect;

export const refillAll = async (): Promise<Array<Refill>> => {
  const sites = await prisma.site.findMany({
    select: REFILL_SELECT,
    where: { bucketRefillAt: { not: null }, bucketTarget: { not: null }, isEnabled: true },
  });

  const refills: Array<Refill> = [];

  for (const site of sites) {
    refills.push(await refillSite(site));
  }

  return refills;
};

export const refill = async (siteId: string): Promise<Refill> =>
  refillSite(await Sites.requireEnabled(siteId));

export const nextDraft = (siteId: string) =>
  prisma.post.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { ...bucketDraftWhere, siteId },
  });

export const readBuckets = async (now: Date) => {
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: {
      ...REFILL_SELECT,
      autoPublishEnabled: true,
      cadenceDays: true,
      lastAutoPublishedAt: true,
      niches: true,
      posts: {
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, id: true, slug: true, title: true },
        take: LISTED_DRAFTS,
        where: bucketDraftWhere,
      },
    },
    where: { isEnabled: true },
  });

  const supplies = await supplyBySite(sites.map((site) => site.id));

  return sites.map((site) => {
    const supply = supplyOf(supplies, site.id);

    return {
      autoPublishEnabled: site.autoPublishEnabled,
      bucketRefillAt: site.bucketRefillAt,
      bucketTarget: site.bucketTarget,
      cadenceDays: site.cadenceDays,
      domain: site.domain,
      drafts: site.posts,
      id: site.id,
      lastAutoPublishedAt: site.lastAutoPublishedAt,
      missedCadence: isDue(site, now) && supply.drafts === 0,
      needsRefill: refillCount(site, supply) > 0,
      nextDueAt: nextDueAt(site),
      niches: site.niches,
      supply,
    };
  });
};
