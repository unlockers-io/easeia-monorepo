import { type Job, type JobKind, JobStatus, type Prisma, prisma } from "@repo/db";

import { getJobPayload, type JobPayloads } from "./payloads";

export const inFlight = {
  status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] },
} satisfies Prisma.JobWhereInput;

const withTarget = {
  post: { select: { id: true, slug: true, title: true } },
  site: { select: { domain: true, id: true } },
} satisfies Prisma.JobInclude;

type JobWithTarget = Prisma.JobGetPayload<{ include: typeof withTarget }>;

type JobFilter = {
  createdSince?: Date;
  kinds?: ReadonlyArray<JobKind>;
  postId?: string;
  siteId?: string;
  status?: JobStatus;
};

type JobListInput = JobFilter & {
  cursor?: string;
  limit: number;
};

type JobList = {
  data: Array<JobWithTarget>;
  nextCursor: string | undefined;
};

type LatestJob<K extends JobKind> = Omit<Job, "payload"> & { payload: JobPayloads[K] };

const whereFor = (filter: JobFilter): Prisma.JobWhereInput => ({
  createdAt: filter.createdSince === undefined ? undefined : { gte: filter.createdSince },
  kind: filter.kinds === undefined ? undefined : { in: [...filter.kinds] },
  OR:
    filter.siteId === undefined
      ? undefined
      : [{ siteId: filter.siteId }, { post: { siteId: filter.siteId } }],
  postId: filter.postId,
  status: filter.status,
});

export const listJobs = async (input: JobListInput): Promise<JobList> => {
  const rows = await prisma.job.findMany({
    cursor: input.cursor === undefined ? undefined : { id: input.cursor },
    include: withTarget,
    orderBy: { createdAt: "desc" },
    skip: input.cursor === undefined ? 0 : 1,
    take: input.limit + 1,
    where: whereFor(input),
  });
  const data = rows.slice(0, input.limit);
  return { data, nextCursor: rows.length > input.limit ? data.at(-1)?.id : undefined };
};

export const getJob = (id: string): Promise<JobWithTarget | null> =>
  prisma.job.findUnique({ include: withTarget, where: { id } });

export const countJobs = (filter: JobFilter): Promise<number> =>
  prisma.job.count({ where: whereFor(filter) });

export const countInFlightBySite = async (
  kind: JobKind,
  siteIds: ReadonlyArray<string>,
): Promise<Map<string, number>> => {
  const rows = await prisma.job.groupBy({
    _count: { id: true },
    by: ["siteId"],
    where: { ...inFlight, kind, siteId: { in: [...siteIds] } },
  });
  return new Map(
    rows.flatMap((row) => (row.siteId === null ? [] : [[row.siteId, row._count.id] as const])),
  );
};

export const findLatestJobByPost = async (
  postIds: ReadonlyArray<string>,
): Promise<Map<string, Job>> => {
  const rows = await prisma.job.findMany({
    distinct: ["postId"],
    orderBy: [{ postId: "asc" }, { createdAt: "desc" }],
    where: { postId: { in: [...postIds] } },
  });
  return new Map(rows.flatMap((row) => (row.postId === null ? [] : [[row.postId, row] as const])));
};

export const findLatestJob = async <K extends JobKind>(kind: K): Promise<LatestJob<K> | null> => {
  const job = await prisma.job.findFirst({ orderBy: { createdAt: "desc" }, where: { kind } });
  return job === null ? null : { ...job, payload: getJobPayload(kind, job.payload) };
};
