import { type Prisma, prisma, type SiteLanguage } from "@repo/db";

type LockedPost = {
  body: string;
  domain: string;
  id: string;
  language: SiteLanguage;
  siteId: string;
};

type BodyEdit<T> = (
  post: LockedPost,
  tx: Prisma.TransactionClient,
) => Promise<{ body: string; result: T }>;

export const editPostBody = <T>(postId: string, edit: BodyEdit<T>): Promise<T | null> =>
  prisma.$transaction(async (tx) => {
    const [post] = await tx.$queryRaw<Array<LockedPost>>`
      SELECT p.id, p.body, p."siteId", s.domain, s.language
      FROM "Post" p
      JOIN "Site" s ON s.id = p."siteId"
      WHERE p.id = ${postId}
      FOR UPDATE OF p
    `;
    if (post === undefined) {
      return null;
    }
    const { body, result } = await edit(post, tx);
    if (body !== post.body) {
      await tx.post.update({ data: { body }, where: { id: postId } });
    }
    return result;
  });
