import { assertAiConfigured } from "@repo/ai";
import {
  postCreateSchema,
  postUpdateSchema,
  type PostCreateInput,
  type PostUpdateInput,
} from "@repo/api-types";
import { JobKind, type Post, PostStatus, prisma, type Site } from "@repo/db";
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

const REPUBLISHABLE: ReadonlyArray<PostStatus> = [
  PostStatus.DRAFT,
  PostStatus.FAILED,
  PostStatus.PUBLISHED,
];

const BUCKET: ReadonlyArray<PostStatus> = [PostStatus.DRAFT];

const AWAITING_PUBLISH: ReadonlyArray<PostStatus> = [PostStatus.SCHEDULED, PostStatus.PUBLISHED];

const requireState = (post: Post, accepted: ReadonlyArray<PostStatus>, action: string): void => {
  if (!accepted.includes(post.status)) {
    throw new PostStateError(`Cannot ${action} a Post in state ${post.status}`);
  }
};

const mayBeDeployed = (post: Post): boolean =>
  post.publishedAt !== null && post.status !== PostStatus.ARCHIVED;

const delayUntil = (scheduledAt: Date | null): number =>
  scheduledAt === null ? 0 : Math.max(0, scheduledAt.getTime() - Date.now());

const enqueueForPost = (postId: string, kinds: ReadonlyArray<JobKind>) =>
  Promise.all(kinds.map((kind) => enqueue({ kind, payload: { postId }, postId })));

const settleLiveChange = async (post: Post, contentChanged: boolean): Promise<void> => {
  if (post.status !== PostStatus.PUBLISHED) {
    return;
  }
  await Sites.requestRedeploy(post.siteId);
  if (contentChanged) {
    await enqueueForPost(post.id, [JobKind.EMBED, JobKind.CRAWL_LINKS]);
  }
};

const sendToPublish = async (post: Post): Promise<PublishResult> => {
  const [claimed] = await prisma.post.updateManyAndReturn({
    data: { status: PostStatus.SCHEDULED },
    where: { id: post.id, status: post.status },
  });
  if (claimed === undefined) {
    throw new PostStateError(`Post ${post.id} changed state while being published`);
  }
  try {
    const job = await enqueue({
      delayMs: delayUntil(claimed.scheduledAt),
      kind: JobKind.PUBLISH,
      payload: { postId: claimed.id },
      postId: claimed.id,
    });
    return { job: { id: job.id }, post: claimed };
  } catch (error) {
    await prisma.post.updateMany({
      data: { status: post.status },
      where: { id: post.id, status: PostStatus.SCHEDULED },
    });
    throw error;
  }
};

const claimPublish = async (
  id: string,
  accepted: ReadonlyArray<PostStatus>,
): Promise<PublishResult> => {
  const post = await requirePost(id);
  requireState(post, accepted, "publish");
  await Sites.requirePublishable(post.siteId);
  return sendToPublish(post);
};

export const create = async (input: PostCreateInput): Promise<CreateResult> => {
  const { publish, ...data } = parseOrThrow(postCreateSchema, input);
  await (publish ? Sites.requirePublishable(data.siteId) : Sites.requireEnabled(data.siteId));
  const post = await prisma.post.create({ data: { ...data, body: normalizeBody(data.body) } });
  return publish ? sendToPublish(post) : { post };
};

export const update = async (id: string, input: PostUpdateInput): Promise<Post> => {
  const data = parseOrThrow(postUpdateSchema, input);
  const before = await requirePost(id);
  const post = await prisma.post.update({ data, where: { id } });
  await settleLiveChange(post, post.body !== before.body || post.title !== before.title);
  return post;
};

export const publish = (id: string): Promise<PublishResult> => claimPublish(id, REPUBLISHABLE);

export const publishBucketDraft = (id: string): Promise<PublishResult> => claimPublish(id, BUCKET);

export const removeBucketDraft = async (id: string): Promise<void> => {
  requireState(await requirePost(id), BUCKET, "remove from the bucket");
  const removed = await prisma.post.deleteMany({ where: { id, status: { in: [...BUCKET] } } });
  if (removed.count === 0) {
    throw new PostStateError(`Post ${id} left the bucket while being removed`);
  }
};

export const unpublish = async (id: string): Promise<{ post: Post }> => {
  const before = await requirePost(id);
  const post = await prisma.post.update({ data: { status: PostStatus.ARCHIVED }, where: { id } });
  if (mayBeDeployed(before)) {
    await Sites.requestRedeploy(post.siteId);
  }
  return { post };
};

export const remove = async (id: string): Promise<Post> => {
  const post = await requirePost(id);
  await prisma.post.delete({ where: { id } });
  if (mayBeDeployed(post)) {
    await Sites.requestRedeploy(post.siteId);
  }
  return post;
};

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

export const completePublish = async (
  id: string,
  { bodyImages }: { bodyImages: boolean },
): Promise<void> => {
  const [post] = await prisma.post.updateManyAndReturn({
    data: { publishedAt: new Date(), status: PostStatus.PUBLISHED },
    where: { id, status: { in: [...AWAITING_PUBLISH] } },
  });
  if (post === undefined) {
    return;
  }
  await settleLiveChange(post, true);
  if (bodyImages) {
    await enqueueForPost(id, [JobKind.GENERATE_BODY_IMAGES]);
  }
};

export const failPublish = async (id: string): Promise<void> => {
  await prisma.post.updateMany({
    data: { status: PostStatus.FAILED },
    where: { id, status: PostStatus.SCHEDULED },
  });
};

export const completeRewrite = async (id: string): Promise<void> => {
  const post = await prisma.post.findUnique({ where: { id } });
  if (post !== null) {
    await settleLiveChange(post, true);
  }
};
