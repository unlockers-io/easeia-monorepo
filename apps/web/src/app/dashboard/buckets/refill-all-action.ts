import type { AuditEntry } from "@repo/policy";

type RefillResult = {
  failures: ReadonlyArray<Error | string>;
  queued: number;
  siteId: string;
};

type RefillAllDependencies = {
  audit: (entry: AuditEntry) => Promise<void>;
  logFailures: (siteId: string, failures: ReadonlyArray<Error | string>) => void;
  refillBuckets: () => Promise<ReadonlyArray<RefillResult>>;
  revalidate: (path: string) => void;
};

type RefillAllResult = {
  failed: number;
  queuedPerSite: Record<string, number>;
  sitesTouched: number;
};

const createRefillAllNeedyBuckets =
  (dependencies: RefillAllDependencies) => async (): Promise<RefillAllResult> => {
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
      queuedPerSite,
      sitesTouched: Object.keys(queuedPerSite).length,
    };
  };

export { createRefillAllNeedyBuckets };
export type { RefillAllDependencies, RefillResult };
