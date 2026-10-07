"use server";

import { assertAiConfigured } from "@repo/ai";
import * as Posts from "@repo/posts";
import {
  bucketConfigErrors,
  countBucketSupply,
  enqueueGeneratePosts,
  gatedRefillCount,
  isValidBucketConfig,
  REFILL_PER_TICK_CEILING,
} from "@repo/posts";
import * as Sites from "@repo/sites";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { requireSession } from "@/lib/auth-helpers";
import { log } from "@/lib/observability";
import { withAuth } from "@/lib/server-action";

import { createRefillAllNeedyBuckets } from "./refill-all-action";

const logRefillFailures = (siteId: string, failures: ReadonlyArray<Error | string>): void => {
  for (const failure of failures) {
    log.error({ err: failure, message: "refill: enqueue failed", siteId });
  }
};

type RefillBucketResult = {
  alreadyInflight: number;
  drafts: number;
  queued: number;
};

export const refillBucketAction = async (siteId: string, count?: number) =>
  withAuth(async (): Promise<RefillBucketResult> => {
    assertAiConfigured();
    const site = await Sites.requireEnabled(siteId);
    const supply = await countBucketSupply(siteId);

    const computeRequested = (): number => {
      if (count !== undefined) {
        return Math.max(0, Math.floor(count));
      }
      const refillAt = site.bucketRefillAt;
      const target = site.bucketTarget;
      if (refillAt === null || target === null || !isValidBucketConfig({ refillAt, target })) {
        return 0;
      }
      return gatedRefillCount({ refillAt, supply: supply.supply, target });
    };
    const requested = computeRequested();

    const toEnqueue = Math.min(requested, REFILL_PER_TICK_CEILING);
    if (toEnqueue === 0) {
      return { alreadyInflight: supply.inflight, drafts: supply.drafts, queued: 0 };
    }

    const { failures } = await enqueueGeneratePosts({
      count: toEnqueue,
      siteId,
    });
    logRefillFailures(siteId, failures);
    await audit({ action: "bucket.refill", target: `site:${siteId}` });

    revalidatePath("/dashboard/buckets");
    return {
      alreadyInflight: supply.inflight,
      drafts: supply.drafts,
      queued: toEnqueue - failures.length,
    };
  });

export type ApplyNetworkDefaultsInput = {
  bucketRefillAt: number | null;
  bucketTarget: number | null;
  cadenceDays: number | null;
  scope: "overwrite" | "unconfigured";
};

export type ApplyNetworkDefaultsResult = {
  bucketSitesUpdated: number;
  cadenceSitesUpdated: number;
  errors: Array<string>;
};

const clampInRange = (raw: number | null, min: number, max: number): number | null => {
  if (raw === null || Number.isNaN(raw)) {
    return null;
  }
  return Math.max(min, Math.min(max, Math.floor(raw)));
};

export const applyNetworkDefaultsAction = async (
  input: ApplyNetworkDefaultsInput,
): Promise<ApplyNetworkDefaultsResult> => {
  await requireSession();

  const cadence = clampInRange(input.cadenceDays, 1, 365);
  const target = clampInRange(input.bucketTarget, 1, 100);
  const refillAt = clampInRange(input.bucketRefillAt, 1, 100);
  const errors: Array<string> = [];

  const cadenceProvided = cadence !== null;
  const bucketAnyProvided = target !== null || refillAt !== null;
  const bucketBothProvided = target !== null && refillAt !== null;

  if (!cadenceProvided && !bucketAnyProvided) {
    errors.push("Fill in at least one section (cadence or bucket).");
  }

  if (bucketAnyProvided && !bucketBothProvided) {
    errors.push("Set both bucket target and refill threshold, or leave both blank.");
  }

  if (bucketBothProvided) {
    errors.push(...bucketConfigErrors({ refillAt, target }));
  }

  if (errors.length > 0) {
    return { bucketSitesUpdated: 0, cadenceSitesUpdated: 0, errors };
  }

  const counts = await Sites.applyNetworkDefaults({
    bucket: bucketBothProvided ? { refillAt, target } : null,
    cadenceDays: cadence,
    scope: input.scope,
  });
  await audit({ action: "site.update", meta: counts, target: "network" });

  revalidatePath("/dashboard/buckets");
  revalidatePath("/dashboard/sites");
  return {
    bucketSitesUpdated: counts.bucketSitesUpdated,
    cadenceSitesUpdated: counts.cadenceSitesUpdated,
    errors: [],
  };
};

const refillAllNeedyBuckets = createRefillAllNeedyBuckets({
  audit,
  logFailures: logRefillFailures,
  refillBuckets: Posts.refillConfiguredBuckets,
  revalidate: revalidatePath,
});

export const refillAllNeedyBucketsAction = async () =>
  withAuth(async () => {
    assertAiConfigured();
    return refillAllNeedyBuckets();
  });

type PublishNextResult = { ok: true } | { error: string; ok: false };

export const publishNextFromBucketAction = async (siteId: string): Promise<PublishNextResult> => {
  await requireSession();
  try {
    const published = await Posts.publishNextBucketDraft(siteId);
    if (!published) {
      return { error: "Bucket is empty", ok: false };
    }
    await audit({ action: "post.publish", target: `post:${published.postId}` });
    revalidatePath("/dashboard/buckets");
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Sites.DomainError
          ? error.message
          : "Could not queue publishing. Try again.",
      ok: false,
    };
  }
};

export const publishDraftAction = async (postId: string) =>
  withAuth(async () => {
    await Posts.publishBucketDraft(postId);
    await audit({ action: "post.publish", target: `post:${postId}` });
    revalidatePath("/dashboard/buckets");
  });

export const deleteDraftAction = async (postId: string) =>
  withAuth(async () => {
    await Posts.removeBucketDraft(postId);
    await audit({ action: "post.delete", target: `post:${postId}` });
    revalidatePath("/dashboard/buckets");
  });
