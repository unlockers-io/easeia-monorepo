import { embedDocument } from "@repo/ai";
import { prisma } from "@repo/db";
import type { ConsumerContext } from "@repo/jobs";
import { createJobLogger } from "@repo/observability/worker";
import * as Posts from "@repo/posts";

export const handleEmbed = async (ctx: ConsumerContext<"EMBED">): Promise<void> => {
  const { jobId, payload } = ctx;
  const { postId } = payload;
  const log = createJobLogger({ jobId, queue: "embed" });
  log.set({ postId });

  const post = await prisma.post.findUnique({
    select: { body: true, id: true, title: true },
    where: { id: postId },
  });

  if (!post) {
    log.warn("embed: post missing, skip");
    log.emit();

    return;
  }

  await Posts.recordEmbedding(postId, await embedDocument(post.title, Posts.stripHtml(post.body)));

  log.info("embed: done");
  log.emit();
};
