import type { SuggestionListQuery } from "@repo/api-types";
import { LinkSource, type Prisma, prisma } from "@repo/db";

export const listSuggestions = ({
  cursor,
  fromPostId,
  limit,
  siteId,
  targetSiteId,
  type,
}: SuggestionListQuery) => {
  const hasCursor = cursor !== undefined && cursor !== "";
  const where: Prisma.LinkWhereInput = {
    approved: null,
    source: LinkSource.SUGGESTED,
  };
  if (fromPostId !== undefined && fromPostId !== "") {
    where.fromPostId = fromPostId;
  }
  if (type !== undefined) {
    where.type = type;
  }
  if (siteId !== undefined && siteId !== "") {
    where.fromPost = { siteId };
  }
  if (targetSiteId !== undefined && targetSiteId !== "") {
    where.toPost = { siteId: targetSiteId };
  }
  return prisma.link.findMany({
    cursor: hasCursor ? { id: cursor } : undefined,
    include: {
      fromPost: {
        select: {
          id: true,
          site: { select: { domain: true } },
          siteId: true,
          slug: true,
          title: true,
        },
      },
      toPost: {
        select: {
          id: true,
          site: { select: { domain: true } },
          siteId: true,
          slug: true,
          title: true,
        },
      },
    },
    orderBy: { suggestedAt: "desc" },
    skip: hasCursor ? 1 : 0,
    take: limit + 1,
    where,
  });
};
export const updateSuggestion = (id: string, data: { anchorText?: string; approved?: boolean }) =>
  prisma.link.update({ data, where: { id, source: "SUGGESTED" } });
