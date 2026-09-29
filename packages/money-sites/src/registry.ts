import {
  moneySiteCreateSchema,
  moneySiteUpdateSchema,
  type MoneySiteCreate,
  type MoneySiteUpdate,
} from "@repo/api-types";
import { prisma } from "@repo/db";

export const listMoneySites = () =>
  prisma.moneySite.findMany({
    include: { _count: { select: { pages: true } } },
    orderBy: { domain: "asc" },
  });
export const createMoneySite = (input: MoneySiteCreate) =>
  prisma.moneySite.create({ data: moneySiteCreateSchema.parse(input) });
export const updateMoneySite = (id: string, input: MoneySiteUpdate) =>
  prisma.moneySite.update({ data: moneySiteUpdateSchema.parse(input), where: { id } });
export const deleteMoneySite = (id: string) => prisma.moneySite.delete({ where: { id } });
