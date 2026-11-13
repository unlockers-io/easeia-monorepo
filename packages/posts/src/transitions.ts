import { assertAiConfigured } from "@repo/ai";
import {
  postCreateSchema,
  postUpdateSchema,
  type PostCreateInput,
  type PostUpdateInput,
} from "@repo/api-types";
import {
  JobKind,
  type Post,
  PostStatus,
  Prisma,
  prisma,
  type Site,
  type SiteLanguage,
} from "@repo/db";
import { enqueue } from "@repo/jobs";
import * as Sites from "@repo/sites";

import { buildProjection, mayBeDeployed } from "./build";
import { PostSlugTakenError, PostStateError } from "./errors";
import { fallbackCategory } from "./fallback-category";
import { normalizeBody } from "./normalize-body";
import { parseOrThrow } from "./parse";
import { requirePost } from "./reads";
import { stripEmDash } from "./strip-em-dash";

type QueuedJob = { id: string };

export type CreateResult = {
  job?: QueuedJob;
  post: Post;
};

export type PublishResult = {
  job: QueuedJob;
  post: Post;
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

export const bucketDraftWhere = {
  scheduledAt: null,
  status: PostStatus.DRAFT,
} satisfies Prisma.PostWhereInput;

const requireState = (post: Post, accepted: ReadonlyArray<PostStatus>, action: string): void => {
  if (!accepted.includes(post.status)) {
    throw new PostStateError(`Cannot ${action} a Post in state ${post.status}`);
  }
};

const requireBucketDraft = (post: Post, action: string): void => {
  if (post.status !== PostStatus.DRAFT || post.scheduledAt !== null) {
    throw new PostStateError(`Cannot ${action}: Post ${post.id} is not a bucket draft`);
  }
};

const delayUntil = (scheduledAt: Date | null): number =>
  scheduledAt === null ? 0 : Math.max(0, scheduledAt.getTime() - Date.now());

type TextFields = {
  body?: string;
  excerpt?: string | null;
  focusKeyword?: string | null;
  title?: string;
};

type PostWrite = Prisma.PostUpdateManyMutationInput & TextFields;

export const normalizePostText = (text: TextFields, language: SiteLanguage): TextFields => {
  const normalized: TextFields = {};

  if (text.body !== undefined) {
    normalized.body = normalizeBody(text.body, language);
  }

  if (text.title !== undefined) {
    normalized.title = stripEmDash(text.title, language, "title").text;
  }

  if (typeof text.excerpt === "string") {
    normalized.excerpt = stripEmDash(text.excerpt, language).text;
  }

  if (typeof text.focusKeyword === "string") {
    normalized.focusKeyword = stripEmDash(text.focusKeyword, language).text;
  }

  return normalized;
};

const claimingSlug = async <T>(write: () => Promise<T>): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PostSlugTakenError();
    }

    throw error;
  }
};

export const lockedPost = async (id: string, tx: Prisma.TransactionClient) => {
  await tx.$executeRaw`SELECT id FROM "Post" WHERE id = ${id} FOR UPDATE`;

  return requirePost(id, tx);
};

const enqueueForPost = (
  postId: string,
  kinds: ReadonlyArray<JobKind>,
  tx: Prisma.TransactionClient,
) => Promise.all(kinds.map((kind) => enqueue({ kind, payload: { postId }, postId }, tx)));

export const settleLiveChange = async (
  post: Post,
  contentChanged: boolean,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  if (!mayBeDeployed(post)) {
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

const claimPublish = (
  id: string,
  requireClaimable: (post: Post) => void,
  onClaim?: (post: Post, tx: Prisma.TransactionClient) => Promise<void>,
): Promise<PublishResult> =>
  prisma.$transaction(async (tx) => {
    const post = await lockedPost(id, tx);
    requireClaimable(post);
    await Sites.requirePublishable(post.siteId, tx);
    await onClaim?.(post, tx);

    return sendToPublish(post, tx);
  });

export const writeIn = async (
  tx: Prisma.TransactionClient,
  id: string,
  data: PostWrite,
  from?: string,
): Promise<Post> => {
  const before = await lockedPost(id, tx);

  if (from !== undefined && before.body !== from) {
    throw new PostStateError(`Post ${id} body changed since it was read`);
  }

  const site = await tx.site.findUniqueOrThrow({ where: { id: before.siteId } });

  const post = await claimingSlug(() =>
    tx.post.update({ data: { ...data, ...normalizePostText(data, site.language) }, where: { id } }),
  );

  if (buildProjection(before) !== buildProjection(post)) {
    await settleLiveChange(post, post.body !== before.body || post.title !== before.title, tx);
  }

  return post;
};

const write = (id: string, data: PostWrite, from?: string, tx?: Prisma.TransactionClient) =>
  tx === undefined
    ? prisma.$transaction((db) => writeIn(db, id, data, from))
    : writeIn(tx, id, data, from);

export const create = async (input: PostCreateInput): Promise<CreateResult> => {
  const { publish, ...data } = parseOrThrow(postCreateSchema, input);

  const site: Site = await (publish
    ? Sites.requirePublishable(data.siteId)
    : Sites.requireEnabled(data.siteId));

  return prisma.$transaction(async (tx) => {
    const post = await claimingSlug(() =>
      tx.post.create({ data: { ...data, ...normalizePostText(data, site.language) } }),
    );

    return publish ? sendToPublish(post, tx) : { post };
  });
};

export const update = async (id: string, input: PostUpdateInput): Promise<Post> =>
  write(id, parseOrThrow(postUpdateSchema, input));

export const reviseBody = (
  id: string,
  { from, ...revision }: BodyRevision,
  tx?: Prisma.TransactionClient,
): Promise<Post> => write(id, revision, from, tx);

export const publish = (id: string): Promise<PublishResult> =>
  claimPublish(id, (post) => {
    requireState(post, REPUBLISHABLE, "publish");
  });

export const publishBucketDraft = (id: string): Promise<PublishResult> =>
  claimPublish(
    id,
    (post) => {
      requireBucketDraft(post, "publish from the bucket");
    },
    async (post, tx) => {
      await Sites.updateSchedule(post.siteId, { lastAutoPublishedAt: new Date() }, tx);
    },
  );

export const removeBucketDraft = async (id: string): Promise<void> => {
  requireBucketDraft(await requirePost(id), "remove from the bucket");
  const removed = await prisma.post.deleteMany({ where: { ...bucketDraftWhere, id } });

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

export const startPublish = async (id: string): Promise<{ post: Post; site: Site } | null> => {
  const post = await prisma.post.findUnique({ where: { id } });

  if (post?.status !== PostStatus.SCHEDULED) {
    return null;
  }

  const site = await Sites.requirePublishable(post.siteId);

  if (post.categories.length > 0) {
    return { post, site };
  }

  const categories = [await fallbackCategory(post)];

  return { post: await prisma.post.update({ data: { categories }, where: { id } }), site };
};

export const completePublish = (id: string): Promise<void> =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Post" WHERE id = ${id} FOR UPDATE`;

    const [post] = await tx.post.updateManyAndReturn({
      data: { publishedAt: new Date(), status: PostStatus.PUBLISHED },
      where: { id, status: PostStatus.SCHEDULED },
    });

    if (post === undefined) {
      return;
    }

    await settleLiveChange(post, true, tx);
    await enqueueForPost(id, [JobKind.GENERATE_BODY_IMAGES], tx);
  });

export const failPublish = async (id: string): Promise<void> => {
  await prisma.post.updateMany({
    data: { status: PostStatus.FAILED },
    where: { id, status: PostStatus.SCHEDULED },
  });
};
