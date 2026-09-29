import {
  postCreateSchema,
  postListQuerySchema,
  postUpdateSchema,
  type PostCreate,
  type PostListQuery,
  type PostUpdate,
} from "@repo/api-types";
import { JobKind, type Post, PostStatus, type Prisma, prisma } from "@repo/db";
import { enqueue } from "@repo/jobs";
import * as Sites from "@repo/sites";

import { PostNotFoundError } from "./errors";
import { normalizeBody } from "./normalize-body";
import { PostStateError } from "./state-error";
import { PostValidationError } from "./validation-error";

export { applyBodyImages, type BodyImage } from "./apply-body-images";
export { normalizeBody } from "./normalize-body";
export {
  analyzeBody,
  dedupeBody,
  splitBlocks,
  type BodyAnalysis,
  type DedupeMethod,
  type DedupeResult,
  type DroppedBlock,
} from "./dedupe-body";
export {
  hasEmDash,
  STRIP_RULES,
  stripEmDash,
  type StripKind,
  type StripResult,
  type StripRule,
} from "./strip-em-dash";
export { PostNotFoundError } from "./errors";
export { PostStateError } from "./state-error";
export { PostValidationError } from "./validation-error";

const requirePost = async (id: string): Promise<Post> => {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    throw new PostNotFoundError(id);
  }
  return post;
};

export type ListInput = PostListQuery;
export type ListResult = {
  data: Array<Post>;
  meta: { nextCursor: string | undefined };
};

type SafeParseLike<T> =
  | { data: T; success: true }
  | { error: { issues: Array<{ message: string; path: Array<PropertyKey> }> }; success: false };

type ParserInput = Parameters<typeof postCreateSchema.safeParse>[0];
type Parser<T> = { safeParse: (raw: ParserInput) => SafeParseLike<T> };

const parseOrThrow = <T>(schema: Parser<T>, raw: ParserInput): T => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new PostValidationError(
      parsed.error.issues.map((i) => ({
        message: i.message,
        path: i.path.join("."),
      })),
    );
  }
  return parsed.data;
};

export const list = async (input: ParserInput): Promise<ListResult> => {
  const { cursor, limit, niche, q, siteId, status } = parseOrThrow<PostListQuery>(
    postListQuerySchema,
    input,
  );
  const hasCursor = cursor !== undefined && cursor !== "";
  const where: Prisma.PostWhereInput = {};
  if (siteId !== undefined && siteId !== "") {
    where.siteId = siteId;
  }
  if (status) {
    where.status = status;
  }
  if (niche) {
    where.niches = { has: niche };
  }
  if (q !== undefined && q !== "") {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.post.findMany({
    cursor: hasCursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    skip: hasCursor ? 1 : 0,
    take: limit + 1,
    where,
  });
  const nextCursor = rows.length > limit ? rows[limit]?.id : undefined;
  return { data: rows.slice(0, limit), meta: { nextCursor } };
};

export const get = (id: string): Promise<Post> => requirePost(id);

export const detail = (postId: string) =>
  prisma.post.findUnique({
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        select: {
          attempts: true,
          createdAt: true,
          id: true,
          kind: true,
          lastError: true,
          status: true,
        },
        take: 5,
      },
      outbound: {
        include: { toPost: { select: { id: true, slug: true, title: true } } },
        orderBy: { position: "asc" },
      },
      site: {
        select: {
          categorySlugMap: true,
          createdAt: true,
          defaultCategory: true,
          domain: true,
          id: true,
          isEnabled: true,
          moneySite: { select: { domain: true } },
          niches: true,
          updatedAt: true,
          vercelDeployHookUrl: true,
        },
      },
    },
    where: { id: postId },
  });

const delayUntil = (scheduledAt: Date | null): number => {
  if (!scheduledAt) {
    return 0;
  }
  return Math.max(0, scheduledAt.getTime() - Date.now());
};

export type CreateResult = {
  job?: { id: string };
  post: Post;
};

export type CreateOptions = {
  redisUrl: string;
};

export const create = async (raw: ParserInput, opts: CreateOptions): Promise<CreateResult> => {
  const data = parseOrThrow<PostCreate>(postCreateSchema, raw);
  await (data.publish ? Sites.requirePublishable(data.siteId) : Sites.requireEnabled(data.siteId));

  const post = await prisma.post.create({
    data: {
      body: normalizeBody(data.body),
      categories: data.categories,
      excerpt: data.excerpt,
      focusKeyword: data.focusKeyword,
      niches: data.niches,
      scheduledAt: data.scheduledAt,
      siteId: data.siteId,
      slug: data.slug,
      status: data.publish ? PostStatus.SCHEDULED : PostStatus.DRAFT,
      tags: data.tags,
      title: data.title,
    },
  });

  if (data.publish) {
    const job = await enqueue({
      delayMs: delayUntil(post.scheduledAt),
      kind: JobKind.PUBLISH,
      payload: { postId: post.id },
      postId: post.id,
      redisUrl: opts.redisUrl,
    });
    return { job: { id: job.id }, post };
  }
  return { post };
};

export const update = (id: string, raw: ParserInput): Promise<Post> => {
  const data = parseOrThrow<PostUpdate>(postUpdateSchema, raw);
  const { publish: _publish, siteId: _siteId, status: _status, ...rest } = data;
  return prisma.post.update({
    data: rest,
    where: { id },
  });
};

const PUBLISHABLE_STATES: ReadonlyArray<PostStatus> = [
  PostStatus.DRAFT,
  PostStatus.FAILED,
  PostStatus.PUBLISHED,
  PostStatus.SCHEDULED,
];

export type PublishResult = {
  job: { id: string };
  post: Post;
};

export type PublishOptions = {
  redisUrl: string;
};

export const publish = async (id: string, opts: PublishOptions): Promise<PublishResult> => {
  const post = await requirePost(id);
  if (!PUBLISHABLE_STATES.includes(post.status)) {
    throw new PostStateError(`Cannot publish a Post in state ${post.status}`);
  }
  await Sites.requirePublishable(post.siteId);
  const claim = await prisma.post.updateMany({
    data: { status: PostStatus.SCHEDULED },
    where: { id, status: { in: [...PUBLISHABLE_STATES] } },
  });
  if (claim.count === 0) {
    throw new PostStateError(`Cannot publish: Post ${id} state changed during claim`);
  }
  const updated = await requirePost(id);
  const job = await enqueue({
    delayMs: delayUntil(updated.scheduledAt),
    kind: JobKind.PUBLISH,
    payload: { postId: id },
    postId: id,
    redisUrl: opts.redisUrl,
  });
  return { job: { id: job.id }, post: updated };
};

export const publishBucketDraft = async (
  postId: string,
  siteId: string,
  opts: PublishOptions,
): Promise<void> => {
  await publish(postId, opts);
  await prisma.site.update({
    data: { lastAutoPublishedAt: new Date() },
    where: { id: siteId },
  });
};

export const publishNextBucketDraft = async (
  siteId: string,
  opts: PublishOptions,
): Promise<{ postId: string } | null> => {
  const draft = await prisma.post.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { scheduledAt: null, siteId, status: PostStatus.DRAFT },
  });
  if (!draft) {
    return null;
  }

  await publishBucketDraft(draft.id, siteId, opts);
  return { postId: draft.id };
};

export type UnpublishOptions = {
  redisUrl: string;
};

/**
 * Mark a published Post as ARCHIVED. The Astro pipeline has no
 * server-side delete step: the next Vercel deploy picks up the
 * missing post automatically.
 */
export const unpublish = async (id: string, _opts: UnpublishOptions): Promise<{ post: Post }> => {
  const updated = await prisma.post.update({
    data: { status: PostStatus.ARCHIVED },
    where: { id },
  });
  return { post: updated };
};

export const remove = async (id: string): Promise<void> => {
  await prisma.post.delete({ where: { id } });
};

export type RecordPublishedAstroInput = { postId: string };

export const recordPublishedAstro = async (input: RecordPublishedAstroInput): Promise<void> => {
  await prisma.post.update({
    data: { publishedAt: new Date(), status: PostStatus.PUBLISHED },
    where: { id: input.postId },
  });
};

export const recordPublishFailure = async (postId: string): Promise<void> => {
  await prisma.post.update({
    data: { status: PostStatus.FAILED },
    where: { id: postId },
  });
};

export { findSimilar, hasEmbedding, recordEmbedding, type SimilarPost } from "./embeddings";

export {
  bucketConfigErrors,
  countBucketSupply,
  countBucketSupplyBySite,
  enqueueGeneratePosts,
  findRefillableSites,
  gatedRefillCount,
  isValidBucketConfig,
  needsRefill,
  REFILL_PER_TICK_CEILING,
  refillConfiguredBuckets,
  type BucketConfig,
  type BucketRefillResult,
  type BucketSupply,
  type EnqueueGeneratePostsInput,
  type EnqueueGeneratePostsResult,
  type GatedRefillInput,
  type NeedsRefillInput,
  type RefillableSite,
} from "./bucket";

export { PostStatus } from "@repo/db";
