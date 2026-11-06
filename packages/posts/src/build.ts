import type { BuildAuthor, BuildImage, BuildPost } from "@easeia/astro-content";
import { type Post, type PostImage, PostStatus, type Prisma, prisma } from "@repo/db";

export const deployedWhere = {
  OR: [
    { status: PostStatus.PUBLISHED },
    { publishedAt: { not: null }, status: { not: PostStatus.ARCHIVED } },
  ],
} satisfies Prisma.PostWhereInput;

export const mayBeDeployed = (post: Pick<Post, "publishedAt" | "status">): boolean =>
  post.status === PostStatus.PUBLISHED ||
  (post.publishedAt !== null && post.status !== PostStatus.ARCHIVED);

type ImageRow = Pick<PostImage, "alt" | "blobUrl" | "filename" | "height" | "isHero" | "width">;

const toBuildImage = (image: ImageRow): BuildImage => ({
  alt: image.alt,
  filename: image.filename,
  height: image.height,
  url: image.blobUrl,
  width: image.width,
});

const toBuildPost = (
  post: Post,
  images: ReadonlyArray<ImageRow>,
  author: BuildAuthor | null,
): BuildPost => {
  const hero = images.find((image) => image.isHero);

  return {
    body: post.body,
    frontmatter: {
      author,
      categories: post.categories,
      description: post.excerpt ?? "",
      draft: false,
      heroImage: null,
      heroImageHeight: hero?.height ?? null,
      heroImageUrl: hero?.blobUrl ?? null,
      heroImageWidth: hero?.width ?? null,
      pubDate: (post.publishedAt ?? post.createdAt).toISOString(),
      seo: { canonical_url: null, focus_keyword: post.focusKeyword },
      status: PostStatus.PUBLISHED,
      tags: post.tags,
      title: post.title,
      updatedDate: post.updatedAt.toISOString(),
    },
    images: images.map(toBuildImage),
    slug: post.slug,
  };
};

export const buildProjection = (post: Post): string => {
  const { frontmatter, ...built } = toBuildPost(post, [], null);
  const { updatedDate: _updatedDate, ...stable } = frontmatter;

  return JSON.stringify({ ...built, frontmatter: stable });
};

export const listForBuild = async (
  siteId: string,
  author: BuildAuthor | null,
): Promise<Array<BuildPost>> => {
  const posts = await prisma.post.findMany({
    include: { images: { orderBy: { id: "asc" } } },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    where: { ...deployedWhere, siteId },
  });

  return posts.map(({ images, ...post }) => toBuildPost(post, images, author));
};

export const listBuildImages = async (siteId: string): Promise<Array<BuildImage>> => {
  const images = await prisma.postImage.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { post: { ...deployedWhere, siteId } },
  });

  return images.map(toBuildImage);
};
