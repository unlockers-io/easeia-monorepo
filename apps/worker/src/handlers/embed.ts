import { AiNotConfiguredError, EMBED_MODEL, embedText } from "@repo/ai";
import { prisma } from "@repo/db";
import type { ConsumerContext } from "@repo/jobs";
import * as Posts from "@repo/posts";

import { createJobLogger } from "../lib/logger";

const MAX_INPUT_CHARS = 6000 * 4;

const stripHtml = (html: string): string =>
  html
    .replaceAll(/<!--[\s\S]*?-->/gv, "")
    .replaceAll(/<[^>]+>/gv, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll(/\s+/gv, " ")
    .trim();

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

  const raw = `${post.title}\n\n${stripHtml(post.body)}`;
  const input = raw.length > MAX_INPUT_CHARS ? raw.slice(0, MAX_INPUT_CHARS) : raw;
  let vector: Array<number>;
  try {
    vector = await embedText(input);
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      log.warn("embed: OPENAI_API_KEY not set, skip");
      log.emit();
      return;
    }
    throw error;
  }

  await Posts.recordEmbedding(postId, vector);

  log.set({ model: EMBED_MODEL });
  log.info("embed: done");
  log.emit();
};
