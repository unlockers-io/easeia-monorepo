"use server";

import { AI_NOT_CONFIGURED_MESSAGE, isAiConfigured } from "@repo/ai";
import { PostStatus, prisma } from "@repo/db";
import * as Posts from "@repo/posts";
import {
  bucketConfigErrors,
  countBucketSupply,
  enqueueGeneratePosts,
  gatedRefillCount,
  isValidBucketConfig,
  PostStateError,
  REFILL_PER_TICK_CEILING,
} from "@repo/posts";
import { DomainError } from "@repo/sites";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-helpers";
import { redisUrl } from "@/lib/env";
import { log } from "@/lib/observability";

import { createRefillAllNeedyBucketsAction } from "./refill-all-action";

const logRefillFailures = (siteId: string, failures: ReadonlyArray<Error | string>): void => {
  for (const failure of failures) {
    log.error({ err: failure, message: "refill: enqueue failed", siteId });
  }
};

export type RefillBucketResult = {
  alreadyInflight: number;
  drafts: number;
  ok: true;
  queued: number;
};

export const refillBucketAction = async (
  siteId: string,
  count?: number,
): Promise<RefillBucketResult | { error: string; ok: false }> => {
  await requireSession();

  if (!isAiConfigured()) {
    return { error: AI_NOT_CONFIGURED_MESSAGE, ok: false };
  }
  const site = await prisma.site.findUnique({
    select: { bucketRefillAt: true, bucketTarget: true, id: true, isEnabled: true },
    where: { id: siteId },
  });
  if (!site || !site.isEnabled) {
    return { error: "Site missing or disabled", ok: false };
  }

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
    return { alreadyInflight: supply.inflight, drafts: supply.drafts, ok: true, queued: 0 };
  }

  const { failures } = await enqueueGeneratePosts({
    count: toEnqueue,
    redisUrl: redisUrl(),
    siteId,
  });
  logRefillFailures(siteId, failures);

  revalidatePath("/dashboard/buckets");
  return {
    alreadyInflight: supply.inflight,
    drafts: supply.drafts,
    ok: true,
    queued: toEnqueue - failures.length,
  };
};

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

  const counts = await prisma.$transaction(async (tx) => {
    let cadenceSitesUpdated = 0;
    let bucketSitesUpdated = 0;
    if (cadenceProvided) {
      const result = await tx.site.updateMany({
        data: { autoPublishEnabled: true, cadenceDays: cadence },
        where:
          input.scope === "unconfigured"
            ? { cadenceDays: null, isEnabled: true }
            : { isEnabled: true },
      });
      cadenceSitesUpdated = result.count;
    }
    if (bucketBothProvided) {
      const result = await tx.site.updateMany({
        data: { bucketRefillAt: refillAt, bucketTarget: target },
        where:
          input.scope === "unconfigured"
            ? { bucketRefillAt: null, bucketTarget: null, isEnabled: true }
            : { isEnabled: true },
      });
      bucketSitesUpdated = result.count;
    }
    return { bucketSitesUpdated, cadenceSitesUpdated };
  });

  revalidatePath("/dashboard/buckets");
  revalidatePath("/dashboard/sites");
  return {
    bucketSitesUpdated: counts.bucketSitesUpdated,
    cadenceSitesUpdated: counts.cadenceSitesUpdated,
    errors: [],
  };
};

const refillAllNeedyBucketsAction = createRefillAllNeedyBucketsAction({
  aiConfigured: isAiConfigured,
  getRedisUrl: redisUrl,
  logFailures: logRefillFailures,
  refillBuckets: Posts.refillConfiguredBuckets,
  requireSession: async () => {
    await requireSession();
  },
  revalidate: revalidatePath,
});

type PublishDraftResult = { ok: true } | { error: string; ok: false };
const publishError = (cause: unknown): PublishDraftResult => ({
  error:
    cause instanceof DomainError || cause instanceof PostStateError
      ? cause.message
      : "Could not queue publishing. Try again.",
  ok: false,
});

export const publishNextFromBucketAction = async (siteId: string): Promise<PublishDraftResult> => {
  await requireSession();
  try {
    const published = await Posts.publishNextBucketDraft(siteId, { redisUrl: redisUrl() });
    if (!published) {
      return { error: "Bucket is empty", ok: false };
    }
    revalidatePath("/dashboard/buckets");
    return { ok: true };
  } catch (error) {
    return publishError(error);
  }
};

export const publishDraftAction = async (postId: string): Promise<PublishDraftResult> => {
  await requireSession();
  const post = await prisma.post.findUnique({
    select: { id: true, siteId: true, status: true },
    where: { id: postId },
  });
  if (!post || post.status !== PostStatus.DRAFT) {
    return { error: "Post is not a draft", ok: false };
  }
  try {
    await Posts.publishBucketDraft(post.id, post.siteId, { redisUrl: redisUrl() });
    revalidatePath("/dashboard/buckets");
    return { ok: true };
  } catch (error) {
    return publishError(error);
  }
};

export const deleteDraftAction = async (postId: string): Promise<void> => {
  await requireSession();
  const post = await prisma.post.findUnique({
    select: { id: true, status: true },
    where: { id: postId },
  });
  if (!post || post.status !== PostStatus.DRAFT) {
    throw new Error("Only drafts can be deleted from the bucket");
  }
  await Posts.remove(post.id);
  revalidatePath("/dashboard/buckets");
};

export { refillAllNeedyBucketsAction };
