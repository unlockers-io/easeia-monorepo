import { type BackfillPhase, type JobKind, JobStatus, prisma, type Prisma } from "@repo/db";

import type { JobPayloads } from "./payloads";
import { inFlight } from "./reads";

export type RunTarget = { id: string; member: string; phase: BackfillPhase };

export type EnqueueInput<K extends JobKind = JobKind> = {
  delayMs?: number;
  kind: K;
  payload: JobPayloads[K];
  postId?: string;
  run?: RunTarget;
  siteId?: string;
};

const rowFor = <K extends JobKind>(input: EnqueueInput<K>): Prisma.JobUncheckedCreateInput => ({
  availableAt: new Date(Date.now() + Math.max(0, input.delayMs ?? 0)),
  kind: input.kind,
  payload: input.payload,
  phase: input.run?.phase,
  postId: input.postId,
  runId: input.run?.id,
  siteId: input.siteId,
  status: JobStatus.QUEUED,
});

export const enqueue = async <K extends JobKind>(
  input: EnqueueInput<K>,
  tx: Prisma.TransactionClient = prisma,
) => {
  const data = rowFor(input);

  if (input.run === undefined) {
    return tx.job.create({ data });
  }

  const id = `${input.run.id}-${input.run.phase}-${input.kind}-${input.run.member}`;

  return tx.job.upsert({ create: { ...data, id }, update: {}, where: { id } });
};

export const lockJobs = async (
  kind: JobKind,
  siteId: string | undefined,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}:${siteId ?? ""}`}))`;
};

const enqueueUnless = (blocking: Prisma.JobWhereInput) => {
  const insert = async <K extends JobKind>(
    input: EnqueueInput<K>,
    tx: Prisma.TransactionClient,
  ) => {
    await lockJobs(input.kind, input.siteId, tx);

    const busy = await tx.job.count({
      where: { ...blocking, kind: input.kind, siteId: input.siteId },
    });

    return busy > 0 ? null : enqueue(input, tx);
  };

  return <K extends JobKind>(input: EnqueueInput<K>, tx?: Prisma.TransactionClient) =>
    tx === undefined ? prisma.$transaction((db) => insert(input, db)) : insert(input, tx);
};

export const enqueueUnlessInFlight = enqueueUnless(inFlight);
export const enqueueUnlessQueued = enqueueUnless({ status: JobStatus.QUEUED });

type CompletedJob<K extends JobKind> = Omit<EnqueueInput<K>, "delayMs"> & {
  finishedAt: Date;
  id: string;
};

export const recordCompletedJob = async <K extends JobKind>({
  finishedAt,
  id,
  ...input
}: CompletedJob<K>): Promise<void> => {
  const row = {
    ...rowFor(input),
    attempts: 1,
    createdAt: finishedAt,
    finishedAt,
    startedAt: finishedAt,
    status: JobStatus.DONE,
  };

  await prisma.job.upsert({ create: { id, ...row }, update: row, where: { id } });
};

export const skipJob = (id: string, reason: string, tx: Prisma.TransactionClient = prisma) =>
  tx.job.updateMany({
    data: { finishedAt: new Date(), lastError: reason, status: JobStatus.SKIPPED },
    where: { id, status: JobStatus.QUEUED },
  });
