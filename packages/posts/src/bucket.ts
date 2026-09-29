import { JobKind, JobStatus, PostStatus, prisma } from "@repo/db";
import { asLoggableError, enqueue, fanoutRejections } from "@repo/jobs";

export const REFILL_PER_TICK_CEILING = 20;

export type GatedRefillInput = {
  ceiling?: number;
  refillAt: number;
  supply: number;
  target: number;
};

export const gatedRefillCount = ({
  ceiling = REFILL_PER_TICK_CEILING,
  refillAt,
  supply,
  target,
}: GatedRefillInput): number => {
  if (supply >= refillAt) {
    return 0;
  }
  const deficit = Math.max(0, target - supply);
  return Math.min(deficit, ceiling);
};

export type BucketConfig = {
  refillAt: number;
  target: number;
};

export const bucketConfigErrors = ({ refillAt, target }: BucketConfig): Array<string> =>
  refillAt > target ? [`Refill threshold (${refillAt}) must be ≤ bucket target (${target}).`] : [];

export const isValidBucketConfig = (config: BucketConfig): boolean =>
  bucketConfigErrors(config).length === 0;

export type NeedsRefillInput = {
  refillAt: number | null;
  supply: number;
  target: number | null;
};

export const needsRefill = ({ refillAt, supply, target }: NeedsRefillInput): boolean =>
  target !== null &&
  refillAt !== null &&
  isValidBucketConfig({ refillAt, target }) &&
  gatedRefillCount({ refillAt, supply, target }) > 0;

export type BucketSupply = {
  drafts: number;
  inflight: number;
  supply: number;
};

const EMPTY_SUPPLY: BucketSupply = { drafts: 0, inflight: 0, supply: 0 };

type SupplyGroup = { count: { id: number }; siteId: string | null };
type BucketSupplyDependencies = {
  countDrafts: (siteIds: ReadonlyArray<string>) => Promise<ReadonlyArray<SupplyGroup>>;
  countInflight: (siteIds: ReadonlyArray<string>) => Promise<ReadonlyArray<SupplyGroup>>;
};

const createCountBucketSupplyBySite =
  (dependencies: BucketSupplyDependencies) =>
  async (siteIds: ReadonlyArray<string>): Promise<Map<string, BucketSupply>> => {
    const [draftsResult, inflightResult] = await Promise.allSettled([
      dependencies.countDrafts(siteIds),
      dependencies.countInflight(siteIds),
    ]);
    if (draftsResult.status === "rejected") {
      throw new Error(
        `countBucketSupplyBySite: drafts count failed: ${String(draftsResult.reason)}`,
      );
    }
    if (inflightResult.status === "rejected") {
      throw new Error(
        `countBucketSupplyBySite: inflight count failed: ${String(inflightResult.reason)}`,
      );
    }

    const supplies = new Map<string, BucketSupply>();
    const entry = (siteId: string): BucketSupply => {
      const existing = supplies.get(siteId);
      if (existing) {
        return existing;
      }
      const created = { ...EMPTY_SUPPLY };
      supplies.set(siteId, created);
      return created;
    };
    for (const row of draftsResult.value) {
      if (row.siteId !== null) {
        entry(row.siteId).drafts = row.count.id;
      }
    }
    for (const row of inflightResult.value) {
      if (row.siteId !== null) {
        entry(row.siteId).inflight = row.count.id;
      }
    }
    for (const supply of supplies.values()) {
      supply.supply = supply.drafts + supply.inflight;
    }
    return supplies;
  };

const countBucketSupplyBySite = createCountBucketSupplyBySite({
  countDrafts: async (siteIds) => {
    const rows = await prisma.post.groupBy({
      _count: { id: true },
      by: ["siteId"],
      where: { scheduledAt: null, siteId: { in: [...siteIds] }, status: PostStatus.DRAFT },
    });
    return rows.map((row) => {
      const { _count: count, siteId } = row;
      return { count, siteId };
    });
  },
  countInflight: async (siteIds) => {
    const rows = await prisma.job.groupBy({
      _count: { id: true },
      by: ["siteId"],
      where: {
        kind: JobKind.GENERATE_POST,
        siteId: { in: [...siteIds] },
        status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] },
      },
    });
    return rows.map((row) => {
      const { _count: count, siteId } = row;
      return { count, siteId };
    });
  },
});

export const countBucketSupply = async (siteId: string): Promise<BucketSupply> => {
  const supplies = await countBucketSupplyBySite([siteId]);
  return supplies.get(siteId) ?? { ...EMPTY_SUPPLY };
};

export type RefillableSite = {
  domain: string;
  id: string;
  refillAt: number;
  target: number;
};

/**
 * Enabled sites with both bucket fields configured, null-narrowed so
 * callers work with numbers instead of re-checking Prisma's nullable
 * columns.
 */
export const findRefillableSites = async (): Promise<Array<RefillableSite>> => {
  const sites = await prisma.site.findMany({
    select: {
      bucketRefillAt: true,
      bucketTarget: true,
      domain: true,
      id: true,
    },
    where: {
      bucketRefillAt: { not: null },
      bucketTarget: { not: null },
      isEnabled: true,
    },
  });
  return sites.flatMap((site) =>
    site.bucketRefillAt === null || site.bucketTarget === null
      ? []
      : [
          {
            domain: site.domain,
            id: site.id,
            refillAt: site.bucketRefillAt,
            target: site.bucketTarget,
          },
        ],
  );
};

export type EnqueueGeneratePostsInput = {
  count: number;
  redisUrl: string;
  siteId: string;
};

export type EnqueueGeneratePostsResult = {
  enqueued: number;
  failures: ReadonlyArray<Error | string>;
};

type EnqueueGeneratePost = (input: { redisUrl: string; siteId: string }) => Promise<void>;

export type BucketRefillResult = {
  configErrors: Array<string>;
  domain: string;
  failures: ReadonlyArray<Error | string>;
  queued: number;
  siteId: string;
  supply: BucketSupply;
};

const createEnqueueGeneratePosts =
  (enqueuePost: EnqueueGeneratePost) =>
  async ({
    count,
    redisUrl,
    siteId,
  }: EnqueueGeneratePostsInput): Promise<EnqueueGeneratePostsResult> => {
    const results = await Promise.allSettled(
      Array.from({ length: count }, () => enqueuePost({ redisUrl, siteId })),
    );
    const failures = fanoutRejections(results).map((rejection) =>
      asLoggableError(rejection.reason),
    );
    return { enqueued: results.length - failures.length, failures };
  };

const enqueueGeneratePosts = createEnqueueGeneratePosts(async ({ redisUrl, siteId }) => {
  await enqueue({
    kind: JobKind.GENERATE_POST,
    payload: { siteId },
    redisUrl,
    siteId,
  });
});

export const refillConfiguredBuckets = async (
  redisUrl: string,
): Promise<Array<BucketRefillResult>> => {
  const sites = await findRefillableSites();
  const supplyBySite = await countBucketSupplyBySite(sites.map((site) => site.id));

  const settled = await Promise.allSettled(
    sites.map(async (site): Promise<BucketRefillResult> => {
      const configErrors = bucketConfigErrors(site);
      const supply = supplyBySite.get(site.id) ?? { ...EMPTY_SUPPLY };
      if (configErrors.length > 0) {
        return {
          configErrors,
          domain: site.domain,
          failures: [],
          queued: 0,
          siteId: site.id,
          supply,
        };
      }

      const count = gatedRefillCount({
        refillAt: site.refillAt,
        supply: supply.supply,
        target: site.target,
      });
      // Both branches share a shape so `enqueued` stays reachable. When they
      // differed, the union made `.enqueued` inaccessible without narrowing and
      // the intended `count` was reported instead, so a tick where every enqueue
      // failed still displayed a full refill.
      const enqueueResult: EnqueueGeneratePostsResult =
        count === 0
          ? { enqueued: 0, failures: [] }
          : await enqueueGeneratePosts({ count, redisUrl, siteId: site.id });

      return {
        configErrors,
        domain: site.domain,
        failures: enqueueResult.failures,
        queued: enqueueResult.enqueued,
        siteId: site.id,
        supply,
      };
    }),
  );

  return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
};

export {
  countBucketSupplyBySite,
  createCountBucketSupplyBySite,
  createEnqueueGeneratePosts,
  enqueueGeneratePosts,
};
export type { BucketSupplyDependencies, EnqueueGeneratePost, SupplyGroup };
