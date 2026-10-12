"use server";

import * as AutoPublish from "@repo/auto-publish";
import { AutoPublishConfigError } from "@repo/auto-publish";
import * as Posts from "@repo/posts";
import * as Sites from "@repo/sites";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { requireSession } from "@/lib/auth-helpers";
import { withAuth } from "@/lib/server-action";

export const refillBucketAction = async (siteId: string) =>
  withAuth(async () => {
    const { queued } = await AutoPublish.refill(siteId);
    if (queued > 0) {
      await audit({ action: "bucket.refill", target: `site:${siteId}` });
      revalidatePath("/dashboard/buckets");
    }
    return { queued };
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

export const applyNetworkDefaultsAction = async (
  input: ApplyNetworkDefaultsInput,
): Promise<ApplyNetworkDefaultsResult> => {
  await requireSession();
  let counts: Awaited<ReturnType<typeof AutoPublish.applyNetworkDefaults>>;
  try {
    counts = await AutoPublish.applyNetworkDefaults({
      bucket: { refillAt: input.bucketRefillAt, target: input.bucketTarget },
      cadenceDays: input.cadenceDays,
      scope: input.scope,
    });
  } catch (error) {
    if (error instanceof AutoPublishConfigError) {
      return { bucketSitesUpdated: 0, cadenceSitesUpdated: 0, errors: error.messages };
    }
    throw error;
  }
  await audit({ action: "site.update", meta: counts, target: "network" });

  revalidatePath("/dashboard/buckets");
  revalidatePath("/dashboard/sites");
  return { ...counts, errors: [] };
};

export const refillAllNeedyBucketsAction = async () =>
  withAuth(async () => {
    const refills = await AutoPublish.refillAll();
    const queuedPerSite: Record<string, number> = {};
    for (const refill of refills) {
      if (refill.queued > 0) {
        queuedPerSite[refill.siteId] = refill.queued;
      }
    }
    await audit({ action: "bucket.refill", meta: queuedPerSite, target: "network" });
    revalidatePath("/dashboard/buckets");
    return { queuedPerSite, sitesTouched: Object.keys(queuedPerSite).length };
  });

type PublishNextResult = { ok: true } | { error: string; ok: false };

export const publishNextFromBucketAction = async (siteId: string): Promise<PublishNextResult> => {
  await requireSession();
  try {
    const published = await AutoPublish.publishNext(siteId);
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
    await AutoPublish.publishDraft(postId);
    await audit({ action: "post.publish", target: `post:${postId}` });
    revalidatePath("/dashboard/buckets");
  });

export const deleteDraftAction = async (postId: string) =>
  withAuth(async () => {
    await Posts.removeBucketDraft(postId);
    await audit({ action: "post.delete", target: `post:${postId}` });
    revalidatePath("/dashboard/buckets");
  });
