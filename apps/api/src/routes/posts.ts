import { createRoute, z } from "@hono/zod-openapi";
import { postCreateSchema, postListQuerySchema, postUpdateSchema } from "@repo/api-types";
import { Niche, PostStatus } from "@repo/db";
import type { Action } from "@repo/policy";
import * as Posts from "@repo/posts";
import type { MiddlewareHandler } from "hono";

import { createRouter } from "@/lib/openapi";
import { errorResponse, idParamSchema } from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

type RouteDependencies = {
  apiAuth: MiddlewareHandler;
  audit: typeof recordAudit;
  posts: Pick<
    typeof Posts,
    "list" | "get" | "create" | "update" | "remove" | "publish" | "unpublish"
  >;
  rateLimit: MiddlewareHandler;
  requirePermission: (action: Action) => MiddlewareHandler<{ Variables: AuthVariables }>;
};

const createPostRoutes = (deps: RouteDependencies) => {
  const postRoutes = createRouter<{ Variables: AuthVariables }>();

  postRoutes.use("*", deps.apiAuth);
  postRoutes.use("*", deps.rateLimit);

  const postSchema = z
    .object({
      body: z.string(),
      canonicalUrl: z.string().nullable().optional(),
      categories: z.array(z.string()),
      createdAt: z.date(),
      excerpt: z.string().nullable(),
      featuredImage: z.string().nullable(),
      featuredImagePrompt: z.string().nullable(),
      focusKeyword: z.string().nullable(),
      id: z.string(),
      niches: z.array(z.enum(Niche)),
      publishedAt: z.date().nullable(),
      scheduledAt: z.date().nullable(),
      siteId: z.string(),
      slug: z.string(),
      status: z.enum(PostStatus),
      tags: z.array(z.string()),
      title: z.string(),
      updatedAt: z.date(),
    })
    .openapi("Post");

  const listResponseSchema = z
    .object({
      data: z.array(postSchema),
      meta: z.object({ nextCursor: z.string().optional() }),
    })
    .openapi("PostsListResponse");

  const itemResponseSchema = z.object({ data: postSchema }).openapi("PostResponse");

  const createResponseSchema = z
    .object({
      data: postSchema,
      job: z.object({ id: z.string() }).optional(),
    })
    .openapi("PostCreateResponse");

  const lifecycleResponseSchema = z
    .object({
      data: z.object({
        jobId: z.string(),
        postId: z.string(),
      }),
    })
    .openapi("PostLifecycleResponse");

  const okResponseSchema = z.object({ ok: z.literal(true) }).openapi("OkResponse");

  const listPostsRoute = createRoute({
    middleware: [deps.requirePermission("posts:read")],
    description:
      "Cursor-paginated list of Posts, newest first unless `sort=oldest`. Filter by site, status, one or more niches (repeat `niche`), or a query matched against title and slug.",
    method: "get",
    path: "/",
    request: { query: postListQuerySchema.openapi("PostListQuery") },
    responses: {
      200: {
        content: { "application/json": { schema: listResponseSchema } },
        description: "Posts page",
      },
      400: errorResponse("Invalid query parameters"),
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Token lacks the posts:read scope"),
    },
    security: [{ bearerAuth: [] }],
    summary: "List posts",
    tags: ["Posts"],
  });

  postRoutes.openapi(listPostsRoute, async (c) => {
    const result = await deps.posts.list(c.req.valid("query"));
    return c.json({ data: result.data, meta: result.meta }, 200);
  });

  const createPostRoute = createRoute({
    middleware: [deps.requirePermission("posts:write")],
    description:
      "Create a Post. If `publish: true`, the Post is queued for publish to its Site immediately and the response includes the queued job id.",
    method: "post",
    path: "/",
    request: {
      body: {
        content: {
          "application/json": { schema: postCreateSchema.openapi("PostCreate") },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: createResponseSchema } },
        description: "Post created",
      },
      400: errorResponse("Validation failed"),
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Token lacks the posts:write scope"),
      404: errorResponse("Target Site not found"),
      409: errorResponse("Target Site disabled or missing a deploy hook"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Create post",
    tags: ["Posts"],
  });

  postRoutes.openapi(createPostRoute, async (c) => {
    const result = await deps.posts.create(c.req.valid("json"));
    await deps.audit(c, { action: "post.create", target: `post:${result.post.id}` });
    return c.json({ data: result.post, job: result.job }, 201);
  });

  const getPostRoute = createRoute({
    middleware: [deps.requirePermission("posts:read")],
    description: "Fetch a Post by id.",
    method: "get",
    path: "/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: itemResponseSchema } },
        description: "Post found",
      },
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Token lacks the posts:read scope"),
      404: errorResponse("Post not found"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Get post",
    tags: ["Posts"],
  });

  postRoutes.openapi(getPostRoute, async (c) => {
    const post = await deps.posts.get(c.req.valid("param").id);
    return c.json({ data: post }, 200);
  });

  const updatePostRoute = createRoute({
    middleware: [deps.requirePermission("posts:write")],
    description:
      "Patch a Post. Omitted fields keep their values. `siteId` is immutable and `status` changes through publish/unpublish. Changing a live post redeploys its Site.",
    method: "patch",
    path: "/{id}",
    request: {
      body: {
        content: {
          "application/json": { schema: postUpdateSchema.openapi("PostUpdate") },
        },
        required: true,
      },
      params: idParamSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: itemResponseSchema } },
        description: "Post updated",
      },
      400: errorResponse("Validation failed"),
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Token lacks the posts:write scope"),
      404: errorResponse("Post not found"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Update post",
    tags: ["Posts"],
  });

  postRoutes.openapi(updatePostRoute, async (c) => {
    const post = await deps.posts.update(c.req.valid("param").id, c.req.valid("json"));
    await deps.audit(c, { action: "post.update", target: `post:${post.id}` });
    return c.json({ data: post }, 200);
  });

  const deletePostRoute = createRoute({
    middleware: [deps.requirePermission("posts:write")],
    description: "Hard-delete the Post. Redeploys its Site when the post was live.",
    method: "delete",
    path: "/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: okResponseSchema } },
        description: "Post deleted",
      },
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Token lacks the posts:write scope"),
      404: errorResponse("Post not found"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Delete post",
    tags: ["Posts"],
  });

  postRoutes.openapi(deletePostRoute, async (c) => {
    const id = c.req.valid("param").id;
    await deps.posts.remove(id);
    await deps.audit(c, { action: "post.delete", target: `post:${id}` });
    return c.json({ ok: true as const }, 200);
  });

  const publishPostRoute = createRoute({
    middleware: [deps.requirePermission("posts:write")],
    description:
      "Move the Post into the publish pipeline. Permitted from DRAFT, FAILED, or PUBLISHED (republish); a SCHEDULED post already has a publish queued. Returns the queued job id.",
    method: "post",
    path: "/{id}/publish",
    request: { params: idParamSchema },
    responses: {
      202: {
        content: { "application/json": { schema: lifecycleResponseSchema } },
        description: "Publish job enqueued",
      },
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Token lacks the posts:write scope"),
      404: errorResponse("Post not found"),
      409: errorResponse("Post not publishable, or its Site is disabled or missing a deploy hook"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Publish post",
    tags: ["Posts"],
  });

  postRoutes.openapi(publishPostRoute, async (c) => {
    const result = await deps.posts.publish(c.req.valid("param").id);
    await deps.audit(c, { action: "post.publish", target: `post:${result.post.id}` });
    return c.json({ data: { jobId: result.job.id, postId: result.post.id } }, 202);
  });

  const unpublishPostRoute = createRoute({
    middleware: [deps.requirePermission("posts:write")],
    description: "Mark a Post as ARCHIVED and redeploy its Site when the post was live.",
    method: "post",
    path: "/{id}/unpublish",
    request: { params: idParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: okResponseSchema } },
        description: "Post archived",
      },
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Token lacks the posts:write scope"),
      404: errorResponse("Post not found"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Unpublish post",
    tags: ["Posts"],
  });

  postRoutes.openapi(unpublishPostRoute, async (c) => {
    const id = c.req.valid("param").id;
    await deps.posts.unpublish(id);
    await deps.audit(c, { action: "post.unpublish", target: `post:${id}` });
    return c.json({ ok: true as const }, 200);
  });

  return postRoutes;
};

const postRoutes = createPostRoutes({
  apiAuth: apiAuthMiddleware,
  audit: recordAudit,
  posts: Posts,
  rateLimit: apiRateLimit,
  requirePermission: requireAction,
});

export { postRoutes, createPostRoutes };
