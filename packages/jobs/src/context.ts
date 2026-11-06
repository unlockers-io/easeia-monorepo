import type { BackfillPhase, JobKind } from "@repo/db";

import type { JobPayloads } from "./payloads";

export class JobSkippedError extends Error {}

export type ConsumerContext<K extends JobKind> = {
  jobId: string;
  payload: JobPayloads[K];
  run?: { id: string; phase: BackfillPhase };
};
