import { JobKind } from "@repo/db";

import { enqueueUnlessInFlight } from "./queue";

type EnqueueTriggerDeployResult = {
  jobId: string | null;
  skipped: boolean;
};

export const enqueueTriggerDeploy = async (siteId: string): Promise<EnqueueTriggerDeployResult> => {
  const job = await enqueueUnlessInFlight({
    kind: JobKind.TRIGGER_DEPLOY,
    payload: { siteId },
    siteId,
  });
  return job === null ? { jobId: null, skipped: true } : { jobId: job.id, skipped: false };
};
