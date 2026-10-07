import { embedText } from "@repo/ai";
import { prisma } from "@repo/db";
import type { ConsumerContext } from "@repo/jobs";
import * as Posts from "@repo/posts";

import { createJobLogger } from "../lib/logger";

const MAX_INPUT_CHARS = 6000 * 4;

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

  const raw = `${post.title}\n\n${Posts.stripHtml(post.body)}`;
  const vector = await embedText(raw.slice(0, MAX_INPUT_CHARS));
  await Posts.recordEmbedding(postId, vector);

  log.info("embed: done");
  log.emit();
};
