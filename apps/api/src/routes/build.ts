import { createHash } from "node:crypto";

import {
  buildImageSchema,
  buildManifestSchema,
  buildPostSchema,
  type BuildAuthor,
  type BuildImage,
  type BuildPost,
} from "@easeia/astro-content";
import { createRoute, z } from "@hono/zod-openapi";
import type { Site } from "@repo/db";
import * as Posts from "@repo/posts";
import * as Sites from "@repo/sites";

import { errorResponse } from "@/lib/openapi-schemas";
import { createProtectedRouter, guards, type Guards } from "@/lib/protected-router";
import type { AuthVariables } from "@/middleware/api-auth";

type BuildRouteDependencies = Omit<Guards, "audit"> & {
  findSite: (siteId: string) => Promise<Site | null>;
  listImages: (siteId: string) => Promise<Array<BuildImage>>;
  listPosts: (siteId: string, author: BuildAuthor | null) => Promise<Array<BuildPost>>;
};

type BuildVariables = AuthVariables & { site: Site };

// The author is part of the hash so editing it invalidates the manifest and
// the sites rebuild; body-only hashing would leave stale bylines live forever.
const computeContentHash = (
  posts: ReadonlyArray<BuildPost>,
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

const siteIdParamsSchema = z.object({ siteId: z.string() });

const postsResponseSchema = z.object({ data: z.array(buildPostSchema) });

const imagesResponseSchema = z.object({ data: z.array(buildImageSchema) });

const buildErrors = {
  401: errorResponse("Missing or invalid bearer token"),
  403: errorResponse("Token lacks the content:read scope or is scoped to a different site"),
  404: errorResponse("Site not found"),
};

const createBuildRoutes = (dependencies: BuildRouteDependencies) => {
  const buildRoutes = createProtectedRouter<BuildVariables>(dependencies);

  buildRoutes.use("/sites/:siteId/*", dependencies.requirePermission("content:read", "siteId"));

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

  buildRoutes.openapi(
    createRoute({
      method: "get",
      path: "/sites/{siteId}/manifest",
      request: { params: siteIdParamsSchema },
      responses: {
        ...buildErrors,
        200: {
          content: { "application/json": { schema: buildManifestSchema } },
          description: "ok",
        },
      },
      security: [{ bearerAuth: [] }],
      summary: "Site build manifest",
      tags: ["Build"],
    }),
    async (c) => {
      const { siteId } = c.req.valid("param");
      const site = c.get("site");
      const author = Sites.buildAuthor(site);
      const posts = await dependencies.listPosts(siteId, author);

      return c.json(
        {
          contentHash: computeContentHash(posts, author),
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
        ...buildErrors,
        200: {
          content: { "application/json": { schema: postsResponseSchema } },
          description: "ok",
        },
      },
      security: [{ bearerAuth: [] }],
      summary: "Posts for Astro build",
      tags: ["Build"],
    }),
    async (c) => {
      const { siteId } = c.req.valid("param");
      const posts = await dependencies.listPosts(siteId, Sites.buildAuthor(c.get("site")));

      return c.json({ data: posts }, 200);
    },
  );

  buildRoutes.openapi(
    createRoute({
      method: "get",
      path: "/sites/{siteId}/images",
      request: { params: siteIdParamsSchema },
      responses: {
        ...buildErrors,
        200: {
          content: { "application/json": { schema: imagesResponseSchema } },
          description: "ok",
        },
      },
      security: [{ bearerAuth: [] }],
      summary: "Images for Astro build",
      tags: ["Build"],
    }),
    async (c) => c.json({ data: await dependencies.listImages(c.req.valid("param").siteId) }, 200),
  );

  return buildRoutes;
};

const buildRoutes = createBuildRoutes({
  ...guards,
  findSite: Sites.find,
  listImages: Posts.listBuildImages,
  listPosts: Posts.listForBuild,
});

export { buildRoutes, createBuildRoutes };

export type { BuildRouteDependencies };
