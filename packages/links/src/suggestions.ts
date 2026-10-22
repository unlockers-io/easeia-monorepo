import type { SuggestionListQuery } from "@repo/api-types";
import { type Link, LinkSource, type Prisma, prisma } from "@repo/db";

import { editPostBody } from "./body";
import { SuggestionAppliedError, SuggestionNotFoundError } from "./errors";
import { withSeeAlsoLinks } from "./see-also";

const postRef = {
  select: {
    id: true,
    site: { select: { domain: true } },
    siteId: true,
    slug: true,
    title: true,
  },
} as const;

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
    include: { fromPost: postRef, toPost: postRef },
    orderBy: { suggestedAt: "desc" },
    skip: hasCursor ? 1 : 0,
    take: limit + 1,
    where,
  });
};

const approve = async (fromPostId: string, links: ReadonlyArray<Link>): Promise<void> => {
  if (links.length === 0) {
    return;
  }

  await editPostBody(fromPostId, (post) =>
    Promise.resolve({ body: withSeeAlsoLinks(post.body, links, post.language), result: null }),
  );
  await prisma.link.updateMany({
    data: { approved: true },
    where: { id: { in: links.map((link) => link.id) } },
  });
};

const requireSuggestion = async (id: string): Promise<Link> => {
  const link = await prisma.link.findFirst({ where: { id, source: LinkSource.SUGGESTED } });

  if (link === null) {
    throw new SuggestionNotFoundError(id);
  }

  return link;
};

export const approveSuggestion = async (id: string): Promise<Link> => {
  const link = await requireSuggestion(id);
  await approve(link.fromPostId, [link]);

  return { ...link, approved: true };
};

export const approveSuggestions = async (
  fromPostId: string,
  ids: ReadonlyArray<string>,
): Promise<void> => {
  const links = await prisma.link.findMany({
    where: { fromPostId, id: { in: [...ids] }, source: LinkSource.SUGGESTED },
  });

  await approve(fromPostId, links);
};

const reviseUnappliedSuggestion = async (
  id: string,
  data: Prisma.LinkUpdateInput,
): Promise<Link> => {
  const link = await requireSuggestion(id);

  if (link.approved === true) {
    throw new SuggestionAppliedError(id);
  }

  return prisma.link.update({ data, where: { id } });
};

export const rejectSuggestion = (id: string): Promise<Link> =>
  reviseUnappliedSuggestion(id, { approved: false });

export const editSuggestionAnchor = (id: string, anchorText: string): Promise<Link> =>
  reviseUnappliedSuggestion(id, { anchorText });
