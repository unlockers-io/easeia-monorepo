import {
  moneySiteCreateSchema,
  moneySiteUpdateSchema,
  type MoneySiteCreate,
  type MoneySiteUpdate,
} from "@repo/api-types";
import { JobKind, Prisma, type PrismaClient } from "@repo/db";
import { enqueue } from "@repo/jobs";

import { MoneySiteDomainTakenError, MoneySiteNotFoundError } from "./errors";

const writing = async <T>(id: string | undefined, write: () => Promise<T>): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new MoneySiteDomainTakenError();
    }

    if (
      id !== undefined &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new MoneySiteNotFoundError(id);
    }

    throw error;
  }
};

export const listMoneySites = (prisma: PrismaClient) =>
  prisma.moneySite.findMany({
    include: { _count: { select: { pages: true } } },
    orderBy: { domain: "asc" },
  });

export const createMoneySite = (prisma: PrismaClient, input: MoneySiteCreate) =>
  writing(undefined, () => prisma.moneySite.create({ data: moneySiteCreateSchema.parse(input) }));

export const updateMoneySite = (prisma: PrismaClient, id: string, input: MoneySiteUpdate) =>
  writing(id, () =>
    prisma.moneySite.update({ data: moneySiteUpdateSchema.parse(input), where: { id } }),
  );

export const deleteMoneySite = (prisma: PrismaClient, id: string) =>
  writing(id, () => prisma.moneySite.delete({ where: { id } }));

export const requestCrawl = async (prisma: PrismaClient, id: string): Promise<{ id: string }> => {
  const site = await prisma.moneySite.findUnique({ select: { id: true }, where: { id } });

  if (site === null) {
    throw new MoneySiteNotFoundError(id);
  }

  const job = await enqueue(prisma, {
    kind: JobKind.CRAWL_MONEY_SITE,
    payload: { moneySiteId: id },
  });

  return { id: job.id };
};

export const detail = async (prisma: PrismaClient, id: string) => {
  const [moneySite, [embedded], crawled] = await Promise.all([
    prisma.moneySite.findUnique({
      include: {
        pages: {
          orderBy: { lastCrawledAt: { nulls: "last", sort: "desc" } },
          select: { id: true, lastCrawledAt: true, niches: true, title: true, url: true },
        },
      },
      where: { id },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "MoneySitePage"
      WHERE "moneySiteId" = ${id} AND embedding IS NOT NULL
    `,
    prisma.moneySitePage.aggregate({ _max: { lastCrawledAt: true }, where: { moneySiteId: id } }),
  ]);

  if (moneySite === null) {
    return null;
  }

  const { pages, ...site } = moneySite;

  return {
    embeddedPages: Number(embedded?.count ?? 0),
    lastCrawledAt: crawled._max.lastCrawledAt,
    moneySite: site,
    pages,
  };
};
