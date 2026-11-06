import { type Prisma, prisma, type SiteLanguage } from "@repo/db";
import { reviseBody } from "@repo/posts";

type EditablePost = {
  body: string;
  domain: string;
  id: string;
  language: SiteLanguage;
  siteId: string;
};

type BodyEdit<T> = (post: EditablePost) => Promise<{ body: string; result: T }>;

export const editPostBody = async <T>(
  postId: string,
  edit: BodyEdit<T>,
  tx?: Prisma.TransactionClient,
): Promise<T | null> => {
  const post = await (tx ?? prisma).post.findUnique({
    select: {
      body: true,
      id: true,
      site: { select: { domain: true, language: true } },
      siteId: true,
    },
    where: { id: postId },
  });

  if (post === null) {
    return null;
  }

  const { site, ...rest } = post;
  const { body, result } = await edit({ ...rest, domain: site.domain, language: site.language });

  if (body !== post.body) {
    await reviseBody(postId, { body, from: post.body }, tx);
  }

  return result;
};
