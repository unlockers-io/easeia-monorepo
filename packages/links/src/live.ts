import { LinkSource, Prisma } from "@repo/db";

export const isLiveLink = (link: { approved: boolean | null; source: LinkSource }): boolean =>
  link.source !== LinkSource.SUGGESTED || link.approved === true;

export const liveLinkWhere = {
  OR: [{ source: { not: LinkSource.SUGGESTED } }, { approved: true }],
} satisfies Prisma.LinkWhereInput;

export const liveLinkSql = Prisma.sql`(l.source <> ${LinkSource.SUGGESTED}::"LinkSource" OR l.approved = true)`;
