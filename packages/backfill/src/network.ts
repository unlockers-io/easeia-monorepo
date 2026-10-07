import { JobKind, JobStatus, PostStatus, prisma } from "@repo/db";
import { countJobs, enqueue, type JobPayloads } from "@repo/jobs";

import { createBackfill } from "./backfill";

type NetworkPhase = JobPayloads["BACKFILL_NETWORK"]["phase"];

export type NetworkCounts = {
  classifiedPosts: number;
  embeddedPosts: number;
  posts: number;
  sites: number;
  suggestDone: number;
};

export const nextNetworkPhase = (
  phase: NetworkPhase,
  counts: NetworkCounts,
): NetworkPhase | "DONE" => {
  if (phase === "CLASSIFY_EMBED") {
    return counts.classifiedPosts >= counts.posts && counts.embeddedPosts >= counts.posts
      ? "SUGGEST_LINKS"
      : "CLASSIFY_EMBED";
  }
  return counts.suggestDone >= counts.posts ? "DONE" : "SUGGEST_LINKS";
};

const readNetworkCounts = async ({
  startedAt,
}: JobPayloads["BACKFILL_NETWORK"]): Promise<NetworkCounts> => {
  const [posts, classifiedPosts, embeddedRows, suggestDone, sites] = await Promise.all([
    prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
    prisma.post.count({ where: { niches: { isEmpty: false }, status: PostStatus.PUBLISHED } }),
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM "Post" WHERE status = 'PUBLISHED' AND embedding IS NOT NULL
    `,
    countJobs({
      createdSince: new Date(startedAt),
      kinds: [JobKind.SUGGEST_LINKS],
      status: JobStatus.DONE,
    }),
    prisma.site.count({ where: { isEnabled: true } }),
  ]);
  return {
    classifiedPosts,
    embeddedPosts: Number(embeddedRows[0]?.c ?? 0),
    posts,
    sites,
    suggestDone,
  };
};

const PHASE_KINDS = {
  CLASSIFY_EMBED: [JobKind.CLASSIFY, JobKind.EMBED],
  SUGGEST_LINKS: [JobKind.SUGGEST_LINKS],
} as const;

export const networkBackfill = createBackfill({
  failureKinds: [JobKind.BACKFILL_NETWORK, JobKind.CLASSIFY, JobKind.EMBED, JobKind.SUGGEST_LINKS],
  fanout: async (phase) => {
    const posts = await prisma.post.findMany({
      select: { id: true },
      where: { status: PostStatus.PUBLISHED },
    });
    return posts.flatMap((post) =>
      PHASE_KINDS[phase].map((kind) => ({
        id: post.id,
        run: async () => {
          await enqueue({ kind, payload: { postId: post.id }, postId: post.id });
        },
      })),
    );
  },
  initialPayload: () =>
    Promise.resolve({ phase: "CLASSIFY_EMBED", startedAt: new Date().toISOString() }),
  kind: JobKind.BACKFILL_NETWORK,
  label: "network backfill",
  nextPhase: nextNetworkPhase,
  readCounts: readNetworkCounts,
});
