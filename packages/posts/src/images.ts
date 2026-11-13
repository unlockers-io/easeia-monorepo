import { PostStatus, type Prisma, prisma } from "@repo/db";

import { applyBodyImages } from "./apply-body-images";
import { lockedPost, settleLiveChange, writeIn } from "./transitions";

export type StoredImage = {
  blobKey: string;
  blobUrl: string;
  filename: string;
  height: number | null;
  mime: string;
  width: number | null;
};

export type BodyImage = StoredImage & {
  alt: string;
  /** 1-based line of the body the image is inserted after. */
  line: number;
};

export const heroOf = async (
  postId: string,
): Promise<{ blobUrl: string; filename: string } | null> =>
  prisma.postImage.findFirst({
    select: { blobUrl: true, filename: true },
    where: { isHero: true, postId },
  });

export const heroUrls = async (postIds: ReadonlyArray<string>): Promise<Map<string, string>> => {
  const heroes = await prisma.postImage.findMany({
    select: { blobUrl: true, postId: true },
    where: { isHero: true, postId: { in: [...postIds] } },
  });

  return new Map(heroes.map((hero) => [hero.postId, hero.blobUrl]));
};

export const listHeroless = (limit: number) =>
  prisma.post.findMany({
    orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, siteId: true },
    take: limit,
    where: { images: { none: { isHero: true } }, status: PostStatus.PUBLISHED },
  });

const storeImage = (
  tx: Prisma.TransactionClient,
  postId: string,
  image: StoredImage & { alt: string | null; isHero: boolean },
) =>
  tx.postImage.upsert({
    create: { ...image, postId },
    update: image,
    where: { postId_filename: { filename: image.filename, postId } },
  });

export const setHero = (postId: string, image: StoredImage): Promise<void> =>
  prisma.$transaction(async (tx) => {
    await lockedPost(postId, tx);
    await tx.postImage.deleteMany({
      where: { filename: { not: image.filename }, isHero: true, postId },
    });
    await storeImage(tx, postId, { ...image, alt: null, isHero: true });

    const post = await tx.post.update({ data: { updatedAt: new Date() }, where: { id: postId } });

    await settleLiveChange(post, false, tx);
  });

export const illustrate = (
  postId: string,
  { from, images }: { from: string; images: ReadonlyArray<BodyImage> },
): Promise<void> =>
  prisma.$transaction(async (tx) => {
    for (const { alt, line: _line, ...image } of images) {
      await storeImage(tx, postId, { ...image, alt, isHero: false });
    }

    await writeIn(
      tx,
      postId,
      {
        body: applyBodyImages(
          from,
          images.map((image) => ({ alt: image.alt, line: image.line, url: image.blobUrl })),
        ),
      },
      from,
    );
  });
