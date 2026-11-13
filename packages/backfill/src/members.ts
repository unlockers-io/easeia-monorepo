import { type JobKind, PostStatus, type Prisma, prisma } from "@repo/db";
import {
  enqueue,
  skipJob,
  JobSkippedError,
  type ConsumerContext,
  type EnqueueInput,
  type RunTarget,
} from "@repo/jobs";

type PostKind = Extract<JobKind, "CLASSIFY" | "EMBED" | "SUGGEST_LINKS" | "REWRITE_POST">;

type PostWork = { [K in PostKind]: EnqueueInput<K> }[PostKind] & { postId: string; run: RunTarget };

export const enqueuePostMember = async (
  input: PostWork,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  await tx.$executeRaw`SELECT id FROM "Post" WHERE id = ${input.postId} FOR SHARE`;
  const post = await tx.post.findUnique({ where: { id: input.postId } });
  const job = await enqueue({ ...input, postId: post?.id }, tx);

  if (post?.status !== PostStatus.PUBLISHED) {
    await skipJob(job.id, "Post is no longer published", tx);
  }
};

export const forPublishedMember =
  <Context extends ConsumerContext<JobKind>>(handler: (ctx: Context) => Promise<void>) =>
  async (ctx: Context): Promise<void> => {
    if (ctx.run !== undefined && "postId" in ctx.payload) {
      const post = await prisma.post.findUnique({ where: { id: ctx.payload.postId } });

      if (post?.status !== PostStatus.PUBLISHED) {
        throw new JobSkippedError("Post is no longer published");
      }
    }

    await handler(ctx);
  };
