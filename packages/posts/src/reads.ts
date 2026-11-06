import { postListQuerySchema, type PostListQueryInput } from "@repo/api-types";
import { pageOf, type Post, type Prisma, prisma } from "@repo/db";

import { PostNotFoundError } from "./errors";
import { parseOrThrow } from "./parse";

export const requirePost = async (
  id: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Post> => {
  const post = await tx.post.findUnique({ where: { id } });

  if (!post) {
    throw new PostNotFoundError(id);
  }

  return post;
};

type ListResult = {
  data: Array<Post>;
  meta: { nextCursor: string | undefined };
};

export const list = async (input: PostListQueryInput): Promise<ListResult> => {
  const { cursor, limit, niche, q, siteId, sort, status } = parseOrThrow(
    postListQuerySchema,
    input,
  );

  const hasCursor = cursor !== undefined && cursor !== "";
  const niches = niche === undefined ? [] : [niche].flat();
  const where: Prisma.PostWhereInput = {};

  if (siteId !== undefined && siteId !== "") {
    where.siteId = siteId;
  }

  if (status) {
    where.status = status;
  }

  if (niches.length > 0) {
    where.niches = { hasSome: niches };
  }

  if (q !== undefined && q !== "") {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.post.findMany({
    cursor: hasCursor ? { id: cursor } : undefined,
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    skip: hasCursor ? 1 : 0,
    take: limit + 1,
    where,
  });

  const { data, nextCursor } = pageOf(rows, limit);

  return { data, meta: { nextCursor } };
};

export const get = (id: string): Promise<Post> => requirePost(id);

export const detail = (postId: string) =>
  prisma.post.findUnique({
    include: {
      site: { include: { moneySite: { select: { domain: true } } } },
    },
    where: { id: postId },
  });
