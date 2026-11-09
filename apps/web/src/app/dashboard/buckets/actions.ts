"use server";

import * as AutoPublish from "@repo/auto-publish";
import * as Posts from "@repo/posts";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
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

export const applyNetworkDefaultsAction = async (input: AutoPublish.NetworkDefaultsInput) =>
  withAuth(async () => {
    const counts = await AutoPublish.applyNetworkDefaults(input);
    await audit({ action: "site.update", meta: counts, target: "network" });
    revalidatePath("/dashboard/buckets");
    revalidatePath("/dashboard/sites");

    return counts;
  });

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

export const publishNextFromBucketAction = async (siteId: string) =>
  withAuth(async () => {
    const published = await AutoPublish.publishNext(siteId);

    if (published !== null) {
      await audit({ action: "post.publish", target: `post:${published.postId}` });
      revalidatePath("/dashboard/buckets");
    }

    return { published: published !== null };
  });

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
