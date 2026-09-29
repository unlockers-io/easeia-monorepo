import { createHash } from "node:crypto";

import { createRoute, z } from "@hono/zod-openapi";
import { PostStatus, prisma } from "@repo/db";
import type { Action } from "@repo/policy";
import type { MiddlewareHandler } from "hono";

import { createRouter } from "@/lib/openapi";
import { errorResponse } from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { apiRateLimit } from "@/middleware/security";
import { requireMatchingSiteKey } from "@/middleware/site-scoped-key";

type BuildAuthor = {
  bio: string | null;
  name: string;
  photoUrl: string | null;
  url: string | null;
};

type BuildSite = {
  authorBio: string | null;
  authorName: string | null;
  authorPhotoUrl: string | null;
  authorUrl: string | null;
  domain: string;
  language: string;
};

type BuildImage = {
  alt: string | null;
  blobUrl: string;
  filename: string;
  height: number | null;
  id: string;
  isHero: boolean;
  width: number | null;
};

type BuildPost = {
  body: string;
  categories: Array<string>;
  createdAt: Date;
  excerpt: string | null;
  focusKeyword: string | null;
  id: string;
  images: Array<BuildImage>;
  publishedAt: Date | null;
  slug: string;
  status: PostStatus;
  tags: Array<string>;
  title: string;
  updatedAt: Date;
};

type BuildRouteDependencies = {
  apiAuth: MiddlewareHandler;
  findImages: (input: {
    orderBy: Array<{ createdAt: "asc" } | { id: "asc" }>;
    siteId: string;
  }) => Promise<ReadonlyArray<BuildImage>>;
  findPosts: (input: {
    imageOrderBy: { id: "asc" };
    postOrderBy: Array<{ id: "asc" } | { publishedAt: "desc" }>;
    siteId: string;
    status: PostStatus;
  }) => Promise<ReadonlyArray<BuildPost>>;
  findSite: (siteId: string) => Promise<BuildSite | null>;
  rateLimit: MiddlewareHandler;
  requirePermission: (action: Action) => MiddlewareHandler;
  requireSiteScope: MiddlewareHandler;
};

type BuildVariables = AuthVariables & { site: BuildSite };

const siteAuthor = (site: BuildSite): BuildAuthor | null =>
  site.authorName === null || site.authorName === ""
    ? null
    : {
        bio: site.authorBio,
        name: site.authorName,
        photoUrl: site.authorPhotoUrl,
        url: site.authorUrl,
      };

// The author is part of the hash so editing it invalidates the manifest and
// the sites rebuild; body-only hashing would leave stale bylines live forever.
const computeContentHash = (
  posts: ReadonlyArray<{
    body: string;
    images: ReadonlyArray<{ filename: string; url: string }>;
  }>,
  author: BuildAuthor | null,
): string => {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(author));
  for (const post of posts) {
    hash.update(post.body);
    for (const image of post.images) {
      hash.update(image.filename);
      hash.update(image.url);
    }
  }
  return hash.digest("hex");
};

const createBuildRoutes = (dependencies: BuildRouteDependencies) => {
  const buildRoutes = createRouter<{ Variables: BuildVariables }>();

  buildRoutes.use("*", dependencies.apiAuth);
  buildRoutes.use("*", dependencies.rateLimit);
  buildRoutes.use("*", dependencies.requirePermission("content:read"));
  buildRoutes.use("/sites/:siteId/*", dependencies.requireSiteScope);

  // The scope check runs first so a mis-scoped key cannot confirm whether a site id exists.
  buildRoutes.use("/sites/:siteId/*", async (c, next) => {
    const siteId = c.req.param("siteId");
    const site = siteId === "" ? null : await dependencies.findSite(siteId);
    if (site === null) {
      return c.json({ error: { code: "NOT_FOUND", message: "Site not found" } }, 404);
    }
    c.set("site", site);
    return next();
  });

  const imageSchema = z.object({
    alt: z.string().nullable(),
    filename: z.string(),
    height: z.number().int().nullable(),
    url: z.string(),
    width: z.number().int().nullable(),
  });

  const seoSchema = z.object({
    canonical_url: z.string().nullable(),
    focus_keyword: z.string().nullable(),
  });

  const authorSchema = z.object({
    bio: z.string().nullable(),
    name: z.string(),
    photoUrl: z.string().nullable(),
    url: z.string().nullable(),
  });

  const frontmatterSchema = z.object({
    author: authorSchema.nullable(),
    categories: z.array(z.string()),
    description: z.string(),
    draft: z.boolean(),
    heroImage: z.string().nullable(),
    heroImageHeight: z.number().int().nullable(),
    heroImageUrl: z.string().nullable(),
    heroImageWidth: z.number().int().nullable(),
    pubDate: z.string(),
    seo: seoSchema.nullable(),
    status: z.string(),
    tags: z.array(z.string()),
    title: z.string(),
    updatedDate: z.string().nullable(),
  });

  const postSchema = z.object({
    body: z.string(),
    frontmatter: frontmatterSchema,
    images: z.array(imageSchema),
    slug: z.string(),
  });

  const siteIdParamsSchema = z.object({ siteId: z.string() });

  const postsResponseSchema = z.object({ data: z.array(postSchema) });

  const imagesResponseSchema = z.object({ data: z.array(imageSchema) });

  const manifestSchema = z.object({
    contentHash: z.string(),
    domain: z.string(),
    generatedAt: z.string(),
    language: z.string(),
    postCount: z.number().int(),
    siteId: z.string(),
  });

  const loadPostsForBuild = async (siteId: string, site: BuildSite) => {
    const author = siteAuthor(site);
    const posts = await dependencies.findPosts({
      imageOrderBy: { id: "asc" },
      postOrderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      siteId,
      status: PostStatus.PUBLISHED,
    });
    return posts.map((p) => {
      const hero = p.images.find((i) => i.isHero);
      return {
        body: p.body,
        frontmatter: {
          author,
          categories: p.categories,
          description: p.excerpt ?? "",
          draft: false,
          heroImage: null,
          heroImageHeight: hero?.height ?? null,
          heroImageUrl: hero?.blobUrl ?? null,
          heroImageWidth: hero?.width ?? null,
          pubDate: (p.publishedAt ?? p.createdAt).toISOString(),
          seo: { canonical_url: null, focus_keyword: p.focusKeyword },
          status: p.status,
          tags: p.tags,
          title: p.title,
          updatedDate: p.updatedAt.toISOString(),
        },
        images: p.images.map((i) => ({
          alt: i.alt,
          filename: i.filename,
          height: i.height,
          url: i.blobUrl,
          width: i.width,
        })),
        slug: p.slug,
      };
    });
  };

  buildRoutes.openapi(
    createRoute({
      method: "get",
      path: "/sites/{siteId}/manifest",
      request: { params: siteIdParamsSchema },
      responses: {
        200: { content: { "application/json": { schema: manifestSchema } }, description: "ok" },
        401: errorResponse("Missing or invalid bearer token"),
        403: errorResponse("Token lacks the content:read scope or is scoped to a different site"),
        404: errorResponse("Site not found"),
      },
      security: [{ bearerAuth: [] }],
      summary: "Site build manifest",
      tags: ["Build"],
    }),
    async (c) => {
      const { siteId } = c.req.valid("param");
      const site = c.get("site");
      const posts = await loadPostsForBuild(siteId, site);
      return c.json(
        {
          contentHash: computeContentHash(posts, siteAuthor(site)),
          domain: site.domain,
          generatedAt: new Date().toISOString(),
          language: site.language,
          postCount: posts.length,
          siteId,
        },
        200,
      );
    },
  );

  buildRoutes.openapi(
    createRoute({
      method: "get",
      path: "/sites/{siteId}/posts",
      request: { params: siteIdParamsSchema },
      responses: {
        200: {
          content: { "application/json": { schema: postsResponseSchema } },
          description: "ok",
        },
        401: errorResponse("Missing or invalid bearer token"),
        403: errorResponse("Token lacks the content:read scope or is scoped to a different site"),
        404: errorResponse("Site not found"),
      },
      security: [{ bearerAuth: [] }],
      summary: "Posts for Astro build",
      tags: ["Build"],
    }),
    async (c) => {
      const { siteId } = c.req.valid("param");
      return c.json({ data: await loadPostsForBuild(siteId, c.get("site")) }, 200);
    },
  );

  buildRoutes.openapi(
    createRoute({
      method: "get",
      path: "/sites/{siteId}/images",
      request: { params: siteIdParamsSchema },
      responses: {
        200: {
          content: { "application/json": { schema: imagesResponseSchema } },
          description: "ok",
        },
        401: errorResponse("Missing or invalid bearer token"),
        403: errorResponse("Token lacks the content:read scope or is scoped to a different site"),
        404: errorResponse("Site not found"),
      },
      security: [{ bearerAuth: [] }],
      summary: "Images for Astro build",
      tags: ["Build"],
    }),
    async (c) => {
      const { siteId } = c.req.valid("param");
      const rows = await dependencies.findImages({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        siteId,
      });
      return c.json(
        {
          data: rows.map((i) => ({
            alt: i.alt,
            filename: i.filename,
            height: i.height,
            url: i.blobUrl,
            width: i.width,
          })),
        },
        200,
      );
    },
  );

  return buildRoutes;
};

const buildRoutes = createBuildRoutes({
  apiAuth: apiAuthMiddleware,
  findImages: ({ orderBy, siteId }) =>
    prisma.postImage.findMany({ orderBy, where: { post: { siteId } } }),
  findPosts: ({ imageOrderBy, postOrderBy, siteId, status }) =>
    prisma.post.findMany({
      include: { images: { orderBy: imageOrderBy } },
      orderBy: postOrderBy,
      where: { siteId, status },
    }),
  findSite: (siteId) =>
    prisma.site.findUnique({
      select: {
        authorBio: true,
        authorName: true,
        authorPhotoUrl: true,
        authorUrl: true,
        domain: true,
        language: true,
      },
      where: { id: siteId },
    }),
  rateLimit: apiRateLimit,
  requirePermission: requireAction,
  requireSiteScope: requireMatchingSiteKey,
});

export { buildRoutes, createBuildRoutes };
export type { BuildImage, BuildPost, BuildRouteDependencies, BuildSite };
