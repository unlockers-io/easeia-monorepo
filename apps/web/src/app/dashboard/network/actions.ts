"use server";

import { isAiConfigured, AiNotConfiguredError } from "@repo/ai";
import { suggestionListQuerySchema } from "@repo/api-types";
import { JobKind } from "@repo/db";
import { enqueue, readBackfillNetworkStatus, readBackfillRewriteStatus } from "@repo/jobs";
import { get as getPost } from "@repo/posts";
import { requirePublishable } from "@repo/sites";
import { listSuggestions, updateSuggestion } from "@repo/suggest-links";
import { z } from "zod";

import { audit } from "@/lib/access";
import { redisUrl } from "@/lib/env";
import { withAuth } from "@/lib/server-action";

export const readBackfillStatusAction = async () => withAuth(readBackfillNetworkStatus);
export const readRewriteStatusAction = async () => withAuth(readBackfillRewriteStatus);
export const startBackfillAction = async () =>
  withAuth(async () => {
    if (!isAiConfigured()) {
      throw new AiNotConfiguredError();
    }
    const job = await enqueue({
      kind: JobKind.BACKFILL_NETWORK,
      payload: { phase: "CLASSIFY_EMBED", startedAt: new Date().toISOString() },
      redisUrl: redisUrl(),
    });
    await audit({ action: "backfill.trigger", target: "network" });
    return job;
  });
export const startRewriteAction = async (force: boolean) =>
  withAuth(async () => {
    if (!isAiConfigured()) {
      throw new AiNotConfiguredError();
    }
    const job = await enqueue({
      kind: JobKind.BACKFILL_REWRITE,
      payload: {
        force: z.boolean().parse(force),
        phase: "CRAWL_MONEY_SITE",
        startedAt: new Date().toISOString(),
      },
      redisUrl: redisUrl(),
    });
    await audit({ action: "rewrite.trigger", target: "network" });
    return job;
  });
export const rewritePostAction = async (postId: string) =>
  withAuth(async () => {
    if (!isAiConfigured()) {
      throw new AiNotConfiguredError();
    }
    const post = await getPost(z.string().min(1).parse(postId));
    await requirePublishable(post.siteId);
    const job = await enqueue({
      kind: JobKind.REWRITE_POST,
      payload: { force: true, postId },
      postId,
      redisUrl: redisUrl(),
    });
    await audit({ action: "rewrite.trigger", target: `post:${postId}` });
    return job;
  });
export const listSuggestionsAction = async (input: z.input<typeof suggestionListQuerySchema>) =>
  withAuth(async () => {
    const parsed = suggestionListQuerySchema.parse(input);
    const rows = await listSuggestions(parsed);
    return {
      data: rows.slice(0, parsed.limit),
      meta: { nextCursor: rows.length > parsed.limit ? (rows[parsed.limit]?.id ?? null) : null },
    };
  });
export const decideSuggestionAction = async (id: string, action: "approve" | "reject") =>
  withAuth(async () => {
    const decision = z.enum(["approve", "reject"]).parse(action);
    const suggestion = await updateSuggestion(z.string().min(1).parse(id), {
      approved: decision === "approve",
    });
    await audit({ action: `link.${decision}`, target: `link:${id}` });
    return suggestion;
  });
