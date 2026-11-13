import { embedDocument } from "@repo/ai";
import { prisma } from "@repo/db";
import * as Posts from "@repo/posts";

import type { JobContext } from "../lib/job-log";

export const handleEmbed = async ({ log, payload }: JobContext<"EMBED">): Promise<void> => {
  const { postId } = payload;
  log.set({ postId });

  const post = await prisma.post.findUnique({
    select: { body: true, id: true, title: true },
    where: { id: postId },
  });

  if (!post) {
    log.warn("embed: post missing, skip");

    return;
  }

  await Posts.recordEmbedding(postId, await embedDocument(post.title, Posts.stripHtml(post.body)));

  log.info("embed: done");
};
