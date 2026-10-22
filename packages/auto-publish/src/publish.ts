import { prisma } from "@repo/db";
import * as Posts from "@repo/posts";
import * as Sites from "@repo/sites";

import { BUCKET_DRAFT, nextDraft } from "./bucket";
import { isDue } from "./due";

export type Published = { postId: string; siteId: string };

export type Skipped = { reason: string; siteId: string };

type Failed = { error: Error; siteId: string };

export type PublishDueResult = {
  failed: Array<Failed>;
  published: Array<Published>;
  skipped: Array<Skipped>;
};

export const publishDraft = async (postId: string): Promise<void> => {
  const { post } = await Posts.publishBucketDraft(postId);
  await Sites.update(post.siteId, { lastAutoPublishedAt: new Date() });
};

export const publishNext = async (siteId: string): Promise<Published | null> => {
  const draft = await nextDraft(siteId);

  if (draft === null) {
    return null;
  }

  await publishDraft(draft.id);

  return { postId: draft.id, siteId };
};

const findDue = async (now: Date) => {
  const sites = await prisma.site.findMany({
    select: { autoPublishEnabled: true, cadenceDays: true, id: true, lastAutoPublishedAt: true },
    where: {
      autoPublishEnabled: true,
      cadenceDays: { not: null },
      isEnabled: true,
      posts: { some: BUCKET_DRAFT },
    },
  });

  return sites.filter((site) => isDue(site, now));
};

export const publishDue = async (now: Date): Promise<PublishDueResult> => {
  const sites = await findDue(now);
  const settled = await Promise.allSettled(sites.map((site) => publishNext(site.id)));
  const result: PublishDueResult = { failed: [], published: [], skipped: [] };

  for (const [index, outcome] of settled.entries()) {
    const siteId = sites[index]?.id ?? "";

    if (outcome.status === "fulfilled") {
      if (outcome.value === null) {
        result.skipped.push({ reason: "bucket emptied before the claim", siteId });
      } else {
        result.published.push(outcome.value);
      }
    } else if (outcome.reason instanceof Sites.DomainError) {
      result.skipped.push({ reason: outcome.reason.message, siteId });
    } else {
      result.failed.push({
        error: outcome.reason instanceof Error ? outcome.reason : new Error(String(outcome.reason)),
        siteId,
      });
    }
  }

  return result;
};
