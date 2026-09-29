import { LinkSource, type Prisma } from "@repo/db";

export const isLiveLink = (link: { approved: boolean | null; source: LinkSource }): boolean =>
  link.source !== LinkSource.SUGGESTED || link.approved === true;

/** The same rule as a Prisma filter, for queries that cannot post-filter. */
export const liveLinkWhere: Prisma.LinkWhereInput = {
  OR: [
    { source: LinkSource.IMPORTED },
    { source: LinkSource.MANUAL },
    { approved: true, source: LinkSource.SUGGESTED },
  ],
};
