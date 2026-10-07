import { type JobKind, JobStatus } from "@repo/db";
import {
  countJobs,
  enqueue,
  enqueueUnlessInFlight,
  findLatestJob,
  settleFanout,
  type ConsumerContext,
  type FanoutTask,
  type JobPayloads,
} from "@repo/jobs";
import { createJobLogger } from "@repo/observability/worker";

import { BackfillAlreadyRunningError } from "./errors";

const POLL_DELAY_MS = 10_000;

type BackfillKind = typeof JobKind.BACKFILL_NETWORK | typeof JobKind.BACKFILL_REWRITE;
type Phase<K extends BackfillKind> = JobPayloads[K]["phase"];
type Counts = Record<string, number>;

type BackfillSpec<K extends BackfillKind, Args extends ReadonlyArray<unknown>, C extends Counts> = {
  failureKinds: ReadonlyArray<JobKind>;
  fanout: (phase: Phase<K>, payload: JobPayloads[K]) => Promise<ReadonlyArray<FanoutTask>>;
  initialPayload: (...args: Args) => Promise<JobPayloads[K]>;
  kind: K;
  label: string;
  nextPhase: (phase: Phase<K>, counts: C) => Phase<K> | "DONE";
  readCounts: (payload: JobPayloads[K]) => Promise<C>;
};

type BackfillStatus = {
  active: boolean;
  counts?: Counts;
  ended?: "done" | "failed" | null;
  phase?: string;
  startedAt?: string;
};

type Backfill<K extends BackfillKind, Args extends ReadonlyArray<unknown>> = {
  readStatus: () => Promise<BackfillStatus>;
  start: (...args: Args) => Promise<{ jobId: string }>;
  tick: (ctx: ConsumerContext<K>) => Promise<void>;
};

const endedBy = (status: JobStatus): BackfillStatus["ended"] => {
  if (status === JobStatus.FAILED) {
    return "failed";
  }
  return status === JobStatus.DONE ? "done" : null;
};

export const createBackfill = <
  K extends BackfillKind,
  Args extends ReadonlyArray<unknown>,
  C extends Counts,
>(
  spec: BackfillSpec<K, Args, C>,
): Backfill<K, Args> => {
  const start = async (...args: Args) => {
    const job = await enqueueUnlessInFlight({
      kind: spec.kind,
      payload: await spec.initialPayload(...args),
    });
    if (job === null) {
      throw new BackfillAlreadyRunningError(spec.label);
    }
    return { jobId: job.id };
  };

  const readStatus = async (): Promise<BackfillStatus> => {
    const latest = await findLatestJob(spec.kind);
    if (latest === null) {
      return { active: false };
    }
    const { payload } = latest;
    const [counts, failed] = await Promise.all([
      spec.readCounts(payload),
      countJobs({
        createdSince: new Date(payload.startedAt),
        kinds: spec.failureKinds,
        status: JobStatus.FAILED,
      }),
    ]);
    const ended = endedBy(latest.status);
    return {
      active: ended === null,
      counts: { ...counts, failed },
      ended,
      phase: ended === "done" ? "DONE" : payload.phase,
      startedAt: payload.startedAt,
    };
  };

  const tick = async ({ jobId, payload }: ConsumerContext<K>): Promise<void> => {
    const log = createJobLogger({ jobId, queue: spec.label });
    const fanout = async (phase: Phase<K>) => {
      const tasks = await spec.fanout(phase, payload);
      await settleFanout(tasks, `${spec.label}: ${phase} enqueue failed`, log);
    };
    const reEnqueue = (next: JobPayloads[K]) =>
      enqueue({ delayMs: POLL_DELAY_MS, kind: spec.kind, payload: next });

    if (payload.initialFanoutDone !== true) {
      log.set({ phase: payload.phase });
      await fanout(payload.phase);
      log.info(`${spec.label}: initial fanout`);
      log.emit();
      await reEnqueue({ ...payload, initialFanoutDone: true });
      return;
    }

    const counts = await spec.readCounts(payload);
    const next = spec.nextPhase(payload.phase, counts);
    log.set({ counts, next, phase: payload.phase });
    log.info(`${spec.label}: tick`);
    if (next === "DONE") {
      log.info(`${spec.label}: complete`);
      log.emit();
      return;
    }
    if (next !== payload.phase) {
      await fanout(next);
    }
    log.emit();
    await reEnqueue({ ...payload, phase: next });
  };

  return { readStatus, start, tick };
};
