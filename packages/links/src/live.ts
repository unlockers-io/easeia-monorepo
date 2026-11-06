import { LinkSource, Prisma } from "@repo/db";

export const liveLinkWhere = {
  OR: [{ source: { not: LinkSource.SUGGESTED } }, { approved: true }],
} satisfies Prisma.LinkWhereInput;

export const liveLinkSql = Prisma.sql`(l.source <> ${LinkSource.SUGGESTED}::"LinkSource" OR l.approved = true)`;
