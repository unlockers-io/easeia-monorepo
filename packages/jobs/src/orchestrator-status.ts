import { type JobKind, JobStatus, type Prisma, prisma } from "@repo/db";

import { getStoredJobPayload } from "./payloads";
import type { JobPayloads } from "./payloads";

type StoredOrchestratorPayload<K extends JobKind> = Partial<JobPayloads[K]> & {
  phase?: string;
  startedAt?: string;
};

type OrchestratorStatusOptions<K extends JobKind> = {
  /** The job kinds this pipeline fans out, used to scope the failure count. */
  failureKinds: ReadonlyArray<JobKind>;
  fallbackPhase: string;
  kind: K;
  loadCounts: (input: {
    payload: StoredOrchestratorPayload<K>;
    startedAt: Date;
  }) => Promise<Record<string, number>>;
};

type StoredOrchestrator = {
  createdAt: Date;
  payload: Prisma.JsonValue;
  status: JobStatus;
};

type OrchestratorStatusDependencies = {
  countFailed: (input: {
    failureKinds: ReadonlyArray<JobKind>;
    startedAt: Date;
  }) => Promise<number>;
  findLatest: (kind: JobKind) => Promise<StoredOrchestrator | null>;
};

const createOrchestratorStatusReader = (dependencies: OrchestratorStatusDependencies) =>
  function readOrchestratorStatus<K extends JobKind>({
    failureKinds,
    fallbackPhase,
    kind,
    loadCounts,
  }: OrchestratorStatusOptions<K>) {
    return async () => {
      const orchestrator = await dependencies.findLatest(kind);
      if (!orchestrator) {
        return { active: false };
      }

      const payload: StoredOrchestratorPayload<K> = getStoredJobPayload(kind, orchestrator.payload);
      const startedAt =
        typeof payload.startedAt === "string" && payload.startedAt !== ""
          ? new Date(payload.startedAt)
          : orchestrator.createdAt;
      const phase = payload.phase ?? fallbackPhase;

      const [counts, failed] = await Promise.all([
        loadCounts({ payload, startedAt }),
        dependencies.countFailed({ failureKinds, startedAt }),
      ]);

      // A terminal retry creates no successor. Treating its stale phase as active
      // would permanently disable the UI trigger.
      let ended: "done" | "failed" | null = null;
      if (orchestrator.status === JobStatus.FAILED) {
        ended = "failed";
      } else if (phase === "DONE") {
        ended = "done";
      }

      return {
        active: ended === null,
        counts: { ...counts, failed },
        ended,
        phase,
        startedAt: startedAt.toISOString(),
      };
    };
  };

const readOrchestratorStatus = createOrchestratorStatusReader({
  countFailed: ({ failureKinds, startedAt }) =>
    prisma.job.count({
      where: {
        createdAt: { gte: startedAt },
        kind: { in: [...failureKinds] },
        status: JobStatus.FAILED,
      },
    }),
  findLatest: (kind) =>
    prisma.job.findFirst({
      orderBy: { createdAt: "desc" },
      where: { kind },
    }),
});

export { createOrchestratorStatusReader, readOrchestratorStatus };
export type { OrchestratorStatusDependencies, StoredOrchestrator };
