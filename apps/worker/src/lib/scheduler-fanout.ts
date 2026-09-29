import { prisma } from "@repo/db";
import * as Posts from "@repo/posts";
import { PostStateError } from "@repo/posts";

import { log } from "./logger";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PublishCandidate = {
  cadenceDays: number | null;
  domain: string;
  id: string;
  lastAutoPublishedAt: Date | null;
};

type PublishDueDependencies = {
  findSites: () => Promise<Array<PublishCandidate>>;
  publishNextBucketDraft: typeof Posts.publishNextBucketDraft;
};

type RefillLowDependencies = {
  refillConfiguredBuckets: typeof Posts.refillConfiguredBuckets;
};

const createPublishDueFromBuckets = (dependencies: PublishDueDependencies) =>
  async function publishDueFromBuckets(redisUrl: string): Promise<void> {
    const candidates = await dependencies.findSites();

    const now = Date.now();
    const due = candidates.filter((site) => {
      if (site.cadenceDays === null) {
        return false;
      }
      if (site.lastAutoPublishedAt === null) {
        return true;
      }
      return now - site.lastAutoPublishedAt.getTime() >= site.cadenceDays * MS_PER_DAY;
    });

    if (due.length === 0) {
      return;
    }

    log.info({
      count: due.length,
      message: "scheduler: due for publish-from-bucket",
      sites: due.map((site) => site.domain),
    });

    await Promise.allSettled(
      due.map(async (site) => {
        let published: { postId: string } | null;
        try {
          published = await dependencies.publishNextBucketDraft(site.id, { redisUrl });
        } catch (error) {
          if (error instanceof PostStateError) {
            log.info({
              message: "scheduler: draft already claimed by another caller, skipping",
              siteDomain: site.domain,
              siteId: site.id,
            });
            return;
          }
          log.error({
            err: error,
            message: "scheduler: publish-from-bucket failed",
            siteDomain: site.domain,
            siteId: site.id,
          });
          return;
        }
        if (!published) {
          log.warn({
            message: "scheduler: bucket empty, skip + rely on refill scan",
            siteDomain: site.domain,
            siteId: site.id,
          });
          return;
        }
        log.info({
          message: "scheduler: published from bucket",
          postId: published.postId,
          siteDomain: site.domain,
          siteId: site.id,
        });
      }),
    );
  };

const createRefillLowBuckets = (dependencies: RefillLowDependencies) =>
  async function refillLowBuckets(redisUrl: string): Promise<void> {
    let results: Awaited<ReturnType<typeof Posts.refillConfiguredBuckets>>;
    try {
      results = await dependencies.refillConfiguredBuckets(redisUrl);
    } catch (error) {
      log.error({
        err: error,
        message: "scheduler: refill scan failed to count supply, skipping tick",
      });
      return;
    }

    for (const result of results) {
      if (result.configErrors.length > 0) {
        log.warn({
          configErrors: result.configErrors,
          message: "scheduler: invalid bucket config (refillAt > target); skipping refill",
          siteDomain: result.domain,
          siteId: result.siteId,
        });
        continue;
      }
      if (result.queued === 0) {
        continue;
      }

      log.info({
        drafts: result.supply.drafts,
        inflight: result.supply.inflight,
        message: "scheduler: refilling bucket",
        siteDomain: result.domain,
        siteId: result.siteId,
        toEnqueue: result.queued,
      });
      for (const failure of result.failures) {
        log.error({
          err: failure,
          message: "scheduler: refill enqueue failed",
          siteDomain: result.domain,
          siteId: result.siteId,
        });
      }
    }
  };

const publishDueFromBuckets = createPublishDueFromBuckets({
  findSites: () =>
    prisma.site.findMany({
      select: {
        cadenceDays: true,
        domain: true,
        id: true,
        lastAutoPublishedAt: true,
      },
      where: {
        autoPublishEnabled: true,
        cadenceDays: { not: null },
        isEnabled: true,
      },
    }),
  publishNextBucketDraft: Posts.publishNextBucketDraft,
});

const refillLowBuckets = createRefillLowBuckets({
  refillConfiguredBuckets: Posts.refillConfiguredBuckets,
});

export {
  createPublishDueFromBuckets,
  createRefillLowBuckets,
  publishDueFromBuckets,
  refillLowBuckets,
};
export type { PublishDueDependencies, RefillLowDependencies };
