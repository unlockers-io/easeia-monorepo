import { assertAiConfigured } from "@repo/ai";
import {
  postCreateSchema,
  postUpdateSchema,
  type PostCreateInput,
  type PostUpdateInput,
} from "@repo/api-types";
import { JobKind, type Post, PostStatus, type Prisma, prisma, type Site } from "@repo/db";
import { enqueue } from "@repo/jobs";
import * as Sites from "@repo/sites";

import { PostStateError } from "./errors";
import { fallbackCategory } from "./fallback-category";
import { normalizeBody } from "./normalize-body";
import { parseOrThrow } from "./parse";
import { requirePost } from "./reads";

type QueuedJob = { id: string };

export type CreateResult = {
  job?: QueuedJob;
  post: Post;
};

export type PublishResult = {
  job: QueuedJob;
  post: Post;
};

export type PublishTarget = {
  post: Post;
  site: Site;
};

export type BodyRevision = {
  body: string;
  excerpt?: string | null;
  focusKeyword?: string | null;
  from: string;
  rewrittenAt?: Date;
  title?: string;
};

const REPUBLISHABLE: ReadonlyArray<PostStatus> = [
  PostStatus.DRAFT,
  PostStatus.FAILED,
  PostStatus.PUBLISHED,
];

const BUCKET: ReadonlyArray<PostStatus> = [PostStatus.DRAFT];

const AWAITING_PUBLISH: ReadonlyArray<PostStatus> = [PostStatus.SCHEDULED];

const requireState = (post: Post, accepted: ReadonlyArray<PostStatus>, action: string): void => {
  if (!accepted.includes(post.status)) {
    throw new PostStateError(`Cannot ${action} a Post in state ${post.status}`);
  }
};

const mayBeDeployed = (post: Post): boolean =>
  post.publishedAt !== null && post.status !== PostStatus.ARCHIVED;

const delayUntil = (scheduledAt: Date | null): number =>
  scheduledAt === null ? 0 : Math.max(0, scheduledAt.getTime() - Date.now());

const lockedPost = async (id: string, tx: Prisma.TransactionClient) => {
  await tx.$executeRaw`SELECT id FROM "Post" WHERE id = ${id} FOR UPDATE`;
  return requirePost(id, tx);
};

const enqueueForPost = (
  postId: string,
  kinds: ReadonlyArray<JobKind>,
  tx: Prisma.TransactionClient,
) => Promise.all(kinds.map((kind) => enqueue({ kind, payload: { postId }, postId }, tx)));

const settleLiveChange = async (
  post: Post,
  contentChanged: boolean,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  if (post.status !== PostStatus.PUBLISHED) {
    return;
  }
  await Sites.requestRedeploy(post.siteId, tx);
  if (contentChanged) {
    await enqueueForPost(post.id, [JobKind.EMBED, JobKind.CRAWL_LINKS], tx);
  }
};

const sendToPublish = async (post: Post, tx: Prisma.TransactionClient): Promise<PublishResult> => {
  const claimed = await tx.post.update({
    data: { status: PostStatus.SCHEDULED },
    where: { id: post.id },
  });
  const job = await enqueue(
    {
      delayMs: delayUntil(claimed.scheduledAt),
      kind: JobKind.PUBLISH,
      payload: { postId: claimed.id },
      postId: claimed.id,
    },
    tx,
  );
  return { job: { id: job.id }, post: claimed };
};

const claimPublish = (id: string, accepted: ReadonlyArray<PostStatus>): Promise<PublishResult> =>
  prisma.$transaction(async (tx) => {
    const post = await lockedPost(id, tx);
    requireState(post, accepted, "publish");
    await Sites.requirePublishable(post.siteId);
    return sendToPublish(post, tx);
  });

const buildProjection = (post: Post) => [
  post.body,
  post.title,
  post.excerpt,
  post.slug,
  post.categories,
  post.tags,
  post.featuredImage,
  post.focusKeyword,
];

const write = (
  id: string,
  { body, ...data }: Prisma.PostUpdateManyMutationInput & { body?: string },
  from?: string,
): Promise<Post> =>
  prisma.$transaction(async (tx) => {
    const before = await lockedPost(id, tx);
    if (from !== undefined && before.body !== from) {
      throw new PostStateError(`Post ${id} body changed since it was read`);
    }
    const site =
      body === undefined ? null : await tx.site.findUniqueOrThrow({ where: { id: before.siteId } });
    const post = await tx.post.update({
      data: {
        ...data,
        ...(site === null || body === undefined
          ? {}
          : { body: normalizeBody(body, site.language) }),
      },
      where: { id },
    });
    if (JSON.stringify(buildProjection(before)) !== JSON.stringify(buildProjection(post))) {
      await settleLiveChange(post, post.body !== before.body || post.title !== before.title, tx);
    }
    return post;
  });

export const create = async (input: PostCreateInput): Promise<CreateResult> => {
  const { publish, ...data } = parseOrThrow(postCreateSchema, input);
  const site = await (publish
    ? Sites.requirePublishable(data.siteId)
    : Sites.requireEnabled(data.siteId));
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: { ...data, body: normalizeBody(data.body, site.language) },
    });
    return publish ? sendToPublish(post, tx) : { post };
  });
};

export const update = async (id: string, input: PostUpdateInput): Promise<Post> =>
  write(id, parseOrThrow(postUpdateSchema, input));

export const reviseBody = (id: string, { from, ...revision }: BodyRevision): Promise<Post> =>
  write(id, revision, from);

export const publish = (id: string): Promise<PublishResult> => claimPublish(id, REPUBLISHABLE);

export const publishBucketDraft = (id: string): Promise<PublishResult> => claimPublish(id, BUCKET);

export const removeBucketDraft = async (id: string): Promise<void> => {
  requireState(await requirePost(id), BUCKET, "remove from the bucket");
  const removed = await prisma.post.deleteMany({ where: { id, status: { in: [...BUCKET] } } });
  if (removed.count === 0) {
    throw new PostStateError(`Post ${id} left the bucket while being removed`);
  }
};

export const unpublish = (id: string): Promise<{ post: Post }> =>
  prisma.$transaction(async (tx) => {
    const before = await lockedPost(id, tx);
    const post = await tx.post.update({ data: { status: PostStatus.ARCHIVED }, where: { id } });
    if (mayBeDeployed(before)) {
      await Sites.requestRedeploy(post.siteId, tx);
    }
    return { post };
  });

export const remove = (id: string): Promise<Post> =>
  prisma.$transaction(async (tx) => {
    const post = await lockedPost(id, tx);
    await tx.post.delete({ where: { id } });
    if (mayBeDeployed(post)) {
      await Sites.requestRedeploy(post.siteId, tx);
    }
    return post;
  });

export const requestRewrite = async (
  id: string,
  { force }: { force: boolean },
): Promise<QueuedJob> => {
  assertAiConfigured();
  const post = await requirePost(id);
  await Sites.requirePublishable(post.siteId);
  const job = await enqueue({
    kind: JobKind.REWRITE_POST,
    payload: { force, postId: id },
    postId: id,
  });
  return { id: job.id };
};

export const startPublish = async (id: string): Promise<PublishTarget | null> => {
  const post = await prisma.post.findUnique({ where: { id } });
  if (post === null || !AWAITING_PUBLISH.includes(post.status)) {
    return null;
  }
  const site = await Sites.requirePublishable(post.siteId);
  if (post.categories.length > 0) {
    return { post, site };
  }
  const categories = [await fallbackCategory(post)];
  return { post: await prisma.post.update({ data: { categories }, where: { id } }), site };
};

export const completePublish = (
  id: string,
  { bodyImages }: { bodyImages: boolean },
): Promise<void> =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Post" WHERE id = ${id} FOR UPDATE`;
    const [post] = await tx.post.updateManyAndReturn({
      data: { publishedAt: new Date(), status: PostStatus.PUBLISHED },
      where: { id, status: { in: [...AWAITING_PUBLISH] } },
    });
    if (post === undefined) {
      return;
    }
    await settleLiveChange(post, true, tx);
    if (bodyImages) {
      await enqueueForPost(id, [JobKind.GENERATE_BODY_IMAGES], tx);
    }
  });

export const failPublish = async (id: string): Promise<void> => {
  await prisma.post.updateMany({
    data: { status: PostStatus.FAILED },
    where: { id, status: PostStatus.SCHEDULED },
  });
};
