"use server";

import { suggestionListQuerySchema } from "@repo/api-types";
import { networkBackfill, rewriteBackfill } from "@repo/backfill";
import { approveSuggestion, listSuggestions, rejectSuggestion } from "@repo/links";
import { z } from "zod";

import { audit } from "@/lib/access";
import { withAuth } from "@/lib/server-action";

export const readBackfillStatusAction = async () => withAuth(networkBackfill.readStatus);
export const readRewriteStatusAction = async () => withAuth(rewriteBackfill.readStatus);

export const startBackfillAction = async () =>
  withAuth(async () => {
    const started = await networkBackfill.start();
    await audit({ action: "backfill.trigger", target: "network" });

    return started;
  });

export const startRewriteAction = async (force: boolean) =>
  withAuth(async () => {
    const started = await rewriteBackfill.start({ force: z.boolean().parse(force) });
    await audit({ action: "rewrite.trigger", target: "network" });

    return started;
  });

export const listSuggestionsAction = async (input: z.input<typeof suggestionListQuerySchema>) =>
  withAuth(async () => {
    const { data, nextCursor } = await listSuggestions(suggestionListQuerySchema.parse(input));

    return { data, meta: { nextCursor: nextCursor ?? null } };
  });

export const decideSuggestionAction = async (id: string, action: "approve" | "reject") =>
  withAuth(async () => {
    const decision = z.enum(["approve", "reject"]).parse(action);
    const decide = decision === "approve" ? approveSuggestion : rejectSuggestion;
    const suggestion = await decide(z.string().min(1).parse(id));
    await audit({ action: `link.${decision}`, target: `link:${id}` });

    return suggestion;
  });
