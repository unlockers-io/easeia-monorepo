import { AI_NOT_CONFIGURED_MESSAGE } from "@repo/ai";
import type { AuditEntry } from "@repo/policy";

type RefillResult = {
  failures: ReadonlyArray<Error | string>;
  queued: number;
  siteId: string;
};

type RefillAllDependencies = {
  aiConfigured: () => boolean;
  audit: (entry: AuditEntry) => Promise<void>;
  logFailures: (siteId: string, failures: ReadonlyArray<Error | string>) => void;
  refillBuckets: () => Promise<ReadonlyArray<RefillResult>>;
  requireSession: () => Promise<void>;
  revalidate: (path: string) => void;
};

type RefillAllResult = {
  failed: number;
  ok: true;
  queuedPerSite: Record<string, number>;
  sitesTouched: number;
};

const createRefillAllNeedyBucketsAction =
  (dependencies: RefillAllDependencies) =>
  async (): Promise<RefillAllResult | { error: string; ok: false }> => {
    await dependencies.requireSession();
    if (!dependencies.aiConfigured()) {
      return { error: AI_NOT_CONFIGURED_MESSAGE, ok: false };
    }
    const results = await dependencies.refillBuckets();
    const queuedPerSite: Record<string, number> = {};
    for (const result of results) {
      dependencies.logFailures(result.siteId, result.failures);
      if (result.queued > 0) {
        queuedPerSite[result.siteId] = result.queued;
      }
    }
    await dependencies.audit({ action: "bucket.refill", meta: queuedPerSite, target: "network" });

    dependencies.revalidate("/dashboard/buckets");
    return {
      failed: results.reduce((total, result) => total + result.failures.length, 0),
      ok: true,
      queuedPerSite,
      sitesTouched: Object.keys(queuedPerSite).length,
    };
  };

export { createRefillAllNeedyBucketsAction };
export type { RefillAllDependencies, RefillResult };
