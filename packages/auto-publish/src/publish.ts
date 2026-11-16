import type { PrismaClient } from "@repo/db";
import { DomainError } from "@repo/errors";
import * as Posts from "@repo/posts";

import { nextDraft } from "./bucket";
import { isDue } from "./rules";

export type Published = { postId: string; siteId: string };

export type Skipped = { reason: string; siteId: string };

type Failed = { error: Error; siteId: string };

export type PublishDueResult = {
  failed: Array<Failed>;
  published: Array<Published>;
  skipped: Array<Skipped>;
};

export const publishDraft = async (prisma: PrismaClient, postId: string): Promise<void> => {
  await Posts.publishBucketDraft(prisma, postId);
};

export const publishNext = async (
  prisma: PrismaClient,
  siteId: string,
): Promise<Published | null> => {
  const draft = await nextDraft(prisma, siteId);

  if (draft === null) {
    return null;
  }

  await publishDraft(prisma, draft.id);

  return { postId: draft.id, siteId };
};

const findDue = async (prisma: PrismaClient, now: Date) => {
  const sites = await prisma.site.findMany({
    select: { autoPublishEnabled: true, cadenceDays: true, id: true, lastAutoPublishedAt: true },
    where: {
      autoPublishEnabled: true,
      cadenceDays: { not: null },
      isEnabled: true,
      posts: { some: Posts.bucketDraftWhere },
    },
  });

  return sites.filter((site) => isDue(site, now));
};

export const publishDue = async (prisma: PrismaClient, now: Date): Promise<PublishDueResult> => {
  const sites = await findDue(prisma, now);
  const settled = await Promise.allSettled(sites.map((site) => publishNext(prisma, site.id)));
  const result: PublishDueResult = { failed: [], published: [], skipped: [] };

  for (const [index, outcome] of settled.entries()) {
    const siteId = sites[index]?.id ?? "";

    if (outcome.status === "fulfilled") {
      if (outcome.value === null) {
        result.skipped.push({ reason: "bucket emptied before the claim", siteId });
      } else {
        result.published.push(outcome.value);
      }
    } else if (outcome.reason instanceof DomainError) {
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
