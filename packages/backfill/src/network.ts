import { JobKind, PostStatus, prisma } from "@repo/db";

import { completed, createBackfill } from "./backfill";
import { enqueuePostMember } from "./members";

export const networkBackfill = createBackfill({
  counts: (run, jobs) => ({
    classifiedPosts: completed(jobs, JobKind.CLASSIFY),
    embeddedPosts: completed(jobs, JobKind.EMBED),
    posts: run.postIds.length,
    suggestDone: completed(jobs, JobKind.SUGGEST_LINKS),
  }),
  kind: JobKind.BACKFILL_NETWORK,
  label: "network backfill",
  members: async () => {
    const posts = await prisma.post.findMany({
      select: { id: true },
      where: { status: PostStatus.PUBLISHED },
    });
    return { moneySiteIds: [], postIds: posts.map((post) => post.id) };
  },
  phases: [
    {
      enqueue: async (run, tx) => {
        for (const postId of run.postIds) {
          for (const kind of [JobKind.CLASSIFY, JobKind.EMBED]) {
            await enqueuePostMember(
              {
                kind,
                payload: { postId },
                postId,
                run: { id: run.id, member: postId, phase: "CLASSIFY_EMBED" },
              },
              tx,
            );
          }
        }
      },
      name: "CLASSIFY_EMBED",
    },
    {
      enqueue: async (run, tx) => {
        for (const postId of run.postIds) {
          await enqueuePostMember(
            {
              kind: JobKind.SUGGEST_LINKS,
              payload: { postId },
              postId,
              run: { id: run.id, member: postId, phase: "SUGGEST_LINKS" },
            },
            tx,
          );
        }
      },
      name: "SUGGEST_LINKS",
    },
  ],
});
