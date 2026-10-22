import {
  type BackfillPhase,
  type BackfillRun,
  type Job,
  type JobKind,
  JobStatus,
  type Prisma,
  prisma,
} from "@repo/db";
import { listRunJobs } from "@repo/jobs";

import { BackfillAlreadyRunningError } from "./errors";

type Phase = {
  enqueue: (run: BackfillRun, tx: Prisma.TransactionClient) => Promise<void>;
  name: BackfillPhase;
};

type Spec<Args extends ReadonlyArray<unknown>> = {
  counts: (run: BackfillRun, jobs: ReadonlyArray<Job>) => Record<string, number>;
  kind: JobKind;
  label: string;
  members: (
    ...args: Args
  ) => Promise<{ force?: boolean; moneySiteIds: Array<string>; postIds: Array<string> }>;
  phases: readonly [Phase, ...Array<Phase>];
};

export const createBackfill = <Args extends ReadonlyArray<unknown>>(spec: Spec<Args>) => {
  const start = async (...args: Args) => {
    const members = await spec.members(...args);
    const first = spec.phases[0];

    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${spec.kind}))`;

        const active = await tx.backfillRun.count({
          where: { kind: spec.kind, status: JobStatus.RUNNING },
        });

        if (active > 0) {
          throw new BackfillAlreadyRunningError(spec.label);
        }

        const run = await tx.backfillRun.create({
          data: { ...members, kind: spec.kind, phase: first.name },
        });

        await first.enqueue(run, tx);

        return { runId: run.id };
      },
      { timeout: 60_000 },
    );
  };

  const tick = async (): Promise<void> => {
    const active = await prisma.backfillRun.findMany({
      where: { kind: spec.kind, status: JobStatus.RUNNING },
    });

    for (const { id } of active) {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT id FROM "BackfillRun" WHERE id = ${id} FOR UPDATE`;
          const run = await tx.backfillRun.findUniqueOrThrow({ where: { id } });

          if (run.status !== JobStatus.RUNNING) {
            return;
          }

          const children = await listRunJobs(run.id, tx);
          const jobs = children.filter((job) => job.phase === run.phase);

          if (
            jobs.some((job) => job.status === JobStatus.QUEUED || job.status === JobStatus.RUNNING)
          ) {
            return;
          }

          const failed = jobs.some((job) => job.status === JobStatus.FAILED);
          const next = spec.phases[spec.phases.findIndex((phase) => phase.name === run.phase) + 1];

          if (failed || next === undefined) {
            await tx.backfillRun.update({
              data: { finishedAt: new Date(), status: failed ? JobStatus.FAILED : JobStatus.DONE },
              where: { id },
            });

            return;
          }

          await tx.backfillRun.update({ data: { phase: next.name }, where: { id } });
          await next.enqueue(run, tx);
        },
        { timeout: 60_000 },
      );
    }
  };

  const readStatus = async () => {
    const run = await prisma.backfillRun.findFirst({
      orderBy: { startedAt: "desc" },
      where: { kind: spec.kind },
    });

    if (run === null) {
      return { active: false };
    }

    const jobs = await listRunJobs(run.id);
    let ended: "done" | "failed" | null = null;

    if (run.status === JobStatus.DONE) {
      ended = "done";
    } else if (run.status === JobStatus.FAILED) {
      ended = "failed";
    }

    return {
      active: ended === null,
      counts: {
        ...spec.counts(run, jobs),
        failed: jobs.filter((job) => job.status === JobStatus.FAILED).length,
        skipped: jobs.filter((job) => job.status === JobStatus.SKIPPED).length,
      },
      ended,
      phase: ended === "done" ? "DONE" : run.phase,
      runId: run.id,
      startedAt: run.startedAt.toISOString(),
    };
  };

  return { readStatus, start, tick };
};

export const completed = (jobs: ReadonlyArray<Job>, kind: JobKind): number =>
  jobs.filter((job) => job.kind === kind && job.status === JobStatus.DONE).length;
