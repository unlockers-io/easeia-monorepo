"use server";

import { isAiConfigured, AiNotConfiguredError } from "@repo/ai";
import { suggestionListQuerySchema } from "@repo/api-types";
import { networkBackfill, rewriteBackfill } from "@repo/backfill";
import { JobKind } from "@repo/db";
import { enqueue } from "@repo/jobs";
import { approveSuggestion, listSuggestions, rejectSuggestion } from "@repo/links";
import { get as getPost } from "@repo/posts";
import { requirePublishable } from "@repo/sites";
import { z } from "zod";

import { audit } from "@/lib/access";
import { withAuth } from "@/lib/server-action";

const requireAi = (): void => {
  if (!isAiConfigured()) {
    throw new AiNotConfiguredError();
  }
};

export const readBackfillStatusAction = async () => withAuth(networkBackfill.readStatus);
export const readRewriteStatusAction = async () => withAuth(rewriteBackfill.readStatus);
export const startBackfillAction = async () =>
  withAuth(async () => {
    requireAi();
    const started = await networkBackfill.start();
    await audit({ action: "backfill.trigger", target: "network" });
    return started;
  });
export const startRewriteAction = async (force: boolean) =>
  withAuth(async () => {
    requireAi();
    const started = await rewriteBackfill.start({ force: z.boolean().parse(force) });
    await audit({ action: "rewrite.trigger", target: "network" });
    return started;
  });
export const rewritePostAction = async (postId: string) =>
  withAuth(async () => {
    requireAi();
    const post = await getPost(z.string().min(1).parse(postId));
    await requirePublishable(post.siteId);
    const job = await enqueue({
      kind: JobKind.REWRITE_POST,
      payload: { force: true, postId },
      postId,
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
    const decide = decision === "approve" ? approveSuggestion : rejectSuggestion;
    const suggestion = await decide(z.string().min(1).parse(id));
    await audit({ action: `link.${decision}`, target: `link:${id}` });
    return suggestion;
  });
