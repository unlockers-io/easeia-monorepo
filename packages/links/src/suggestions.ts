import type { SuggestionListQuery } from "@repo/api-types";
import { type Link, LinkSource, pageOf, type Prisma, prisma } from "@repo/db";

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

export const listSuggestions = async ({
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

  const rows = await prisma.link.findMany({
    cursor: hasCursor ? { id: cursor } : undefined,
    include: { fromPost: postRef, toPost: postRef },
    orderBy: { suggestedAt: "desc" },
    skip: hasCursor ? 1 : 0,
    take: limit + 1,
    where,
  });

  return pageOf(rows, limit);
};

const approve = async (
  fromPostId: string,
  links: ReadonlyArray<Link>,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  if (links.length === 0) {
    return;
  }

  await editPostBody(
    fromPostId,
    (post) =>
      Promise.resolve({ body: withSeeAlsoLinks(post.body, links, post.language), result: null }),
    tx,
  );
  await tx.link.updateMany({
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
  await prisma.$transaction((tx) => approve(link.fromPostId, [link], tx));

  return { ...link, approved: true };
};

export const approveSuggestions = async (
  fromPostId: string,
  ids: ReadonlyArray<string>,
  tx?: Prisma.TransactionClient,
): Promise<void> => {
  const run = async (db: Prisma.TransactionClient) => {
    const links = await db.link.findMany({
      where: { fromPostId, id: { in: [...ids] }, source: LinkSource.SUGGESTED },
    });

    await approve(fromPostId, links, db);
  };

  await (tx === undefined ? prisma.$transaction(run) : run(tx));
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
