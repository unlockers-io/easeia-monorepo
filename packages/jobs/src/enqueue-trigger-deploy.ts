import { JobKind, JobStatus, prisma } from "@repo/db";

import { enqueue } from "./enqueue-core";

export type EnqueueTriggerDeployInput = {
  redisUrl: string;
  siteId: string;
};

export type EnqueueTriggerDeployResult = {
  jobId: string | null;
  skipped: boolean;
};

type TriggerDeployDependencies = {
  enqueueDeploy: (input: EnqueueTriggerDeployInput) => Promise<{ id: string }>;
  findInFlight: (siteId: string) => Promise<{ id: string } | null>;
};

const createEnqueueTriggerDeploy =
  (dependencies: TriggerDeployDependencies) =>
  async (input: EnqueueTriggerDeployInput): Promise<EnqueueTriggerDeployResult> => {
    const existing = await dependencies.findInFlight(input.siteId);
    if (existing) {
      return { jobId: null, skipped: true };
    }
    const job = await dependencies.enqueueDeploy(input);
    return { jobId: job.id, skipped: false };
  };

const enqueueTriggerDeploy = createEnqueueTriggerDeploy({
  enqueueDeploy: (input) =>
    enqueue({
      kind: JobKind.TRIGGER_DEPLOY,
      payload: { siteId: input.siteId },
      redisUrl: input.redisUrl,
      siteId: input.siteId,
    }),
  findInFlight: (siteId) =>
    prisma.job.findFirst({
      select: { id: true },
      where: {
        kind: JobKind.TRIGGER_DEPLOY,
        siteId,
        status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] },
      },
    }),
});

export { createEnqueueTriggerDeploy, enqueueTriggerDeploy };
export type { TriggerDeployDependencies };
