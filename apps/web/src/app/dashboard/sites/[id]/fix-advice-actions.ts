"use server";

import { AI_NOT_CONFIGURED_MESSAGE, AiNotConfiguredError, type FixAdvice } from "@repo/ai";
import * as Sites from "@repo/sites";
import { z } from "zod";

import { getSession } from "@/lib/auth-helpers";
import { log } from "@/lib/observability";

import { checkNameSchema, createGetFixAdviceAction } from "./fix-advice-action-service";
import { callGenerator, getCachedAdvice, setCachedAdvice } from "./fix-advice-cache";

const bulkInputSchema = z.object({
  checkNames: z.array(checkNameSchema).min(1).max(100),
  siteId: z.string().min(1),
});

export type BulkFixAdviceInput = z.infer<typeof bulkInputSchema>;

export type BulkFixAdviceResult =
  | {
      ok: true;
      results: ReadonlyArray<
        | { advice: FixAdvice; checkName: string; ok: true }
        | {
            checkName: string;
            error: string;
            ok: false;
          }
      >;
    }
  | { error: string; ok: false };

const getFixAdviceAction = createGetFixAdviceAction({
  findSite: Sites.find,
  generate: callGenerator,
  getCached: getCachedAdvice,
  getSession,
  logError: ({ checkName, error, siteId }) => {
    log.error({ checkName, error, message: "getFixAdviceAction failed", siteId });
  },
  setCached: setCachedAdvice,
});

const BULK_CONCURRENCY = 8;

export const bulkGenerateFixAdviceAction = async (
  input: BulkFixAdviceInput,
): Promise<BulkFixAdviceResult> => {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated.", ok: false };
  }
  const parsed = bulkInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input.", ok: false };
  }
  const { checkNames, siteId } = parsed.data;

  const site = await Sites.find(siteId);
  if (!site) {
    return { error: "Site not found.", ok: false };
  }
  const siteContext = {
    domain: site.domain,
    niches: site.niches,
  };

  const unique = [...new Set(checkNames)];
  const results: Array<
    | { advice: FixAdvice; checkName: string; ok: true }
    | { checkName: string; error: string; ok: false }
  > = [];

  for (let i = 0; i < unique.length; i += BULK_CONCURRENCY) {
    const chunk = unique.slice(i, i + BULK_CONCURRENCY);
    const batch = await Promise.allSettled(
      chunk.map(async (checkName) => {
        const cached = getCachedAdvice(siteId, checkName);
        if (cached) {
          return { advice: cached, checkName };
        }
        const advice = await callGenerator({ checkName, site: siteContext });
        setCachedAdvice(siteId, checkName, advice);
        return { advice, checkName };
      }),
    );
    for (const [idx, settled] of batch.entries()) {
      const checkName = chunk[idx];
      if (checkName === undefined || checkName === "") {
        continue;
      }
      if (settled.status === "fulfilled") {
        results.push({ advice: settled.value.advice, checkName, ok: true });
      } else {
        const reason: unknown = settled.reason;
        const message =
          reason instanceof AiNotConfiguredError
            ? AI_NOT_CONFIGURED_MESSAGE
            : "Could not generate fix advice.";
        if (!(reason instanceof AiNotConfiguredError)) {
          log.error({
            checkName,
            error: reason instanceof Error ? reason.message : String(reason),
            message: "bulkGenerateFixAdviceAction failed",
          });
        }
        results.push({ checkName, error: message, ok: false });
      }
    }
  }

  return { ok: true, results };
};

export { getFixAdviceAction };
