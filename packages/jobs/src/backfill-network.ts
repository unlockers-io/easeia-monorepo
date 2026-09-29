import { JobKind, JobStatus, PostStatus, prisma } from "@repo/db";
import { z } from "zod";

const BACKFILL_NETWORK_PHASES = ["CLASSIFY_EMBED", "SUGGEST_LINKS", "DONE"] as const;
const backfillNetworkPhaseSchema = z.enum(BACKFILL_NETWORK_PHASES);

type BackfillNetworkPhase = (typeof BACKFILL_NETWORK_PHASES)[number];
type BackfillNetworkPhaseInput = Parameters<typeof backfillNetworkPhaseSchema.safeParse>[0];

const isBackfillNetworkPhase = (value: BackfillNetworkPhaseInput): value is BackfillNetworkPhase =>
  backfillNetworkPhaseSchema.safeParse(value).success;

type BackfillNetworkPayload = {
  initialFanoutDone?: boolean;
  phase: BackfillNetworkPhase;
  startedAt: string;
};

type BackfillNetworkCounts = {
  classifiedPosts: number;
  embeddedPosts: number;
  posts: number;
  suggestLinksDone: number;
};

const nextBackfillNetworkPhase = (
  current: BackfillNetworkPhase,
  counts: BackfillNetworkCounts,
): BackfillNetworkPhase => {
  switch (current) {
    case "CLASSIFY_EMBED": {
      return counts.classifiedPosts >= counts.posts && counts.embeddedPosts >= counts.posts
        ? "SUGGEST_LINKS"
        : "CLASSIFY_EMBED";
    }
    case "DONE": {
      return "DONE";
    }
    case "SUGGEST_LINKS": {
      return counts.suggestLinksDone >= counts.posts ? "DONE" : "SUGGEST_LINKS";
    }
    default: {
      return current;
    }
  }
};

const readBackfillNetworkCounts = async (startedAt: Date): Promise<BackfillNetworkCounts> => {
  const embeddedQuery = prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "Post" WHERE status = 'PUBLISHED' AND embedding IS NOT NULL
  `;
  const [posts, classifiedPosts, embeddedRows, suggestLinksDone] = await Promise.all([
    prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
    prisma.post.count({ where: { niches: { isEmpty: false }, status: PostStatus.PUBLISHED } }),
    embeddedQuery,
    prisma.job.count({
      where: {
        createdAt: { gte: startedAt },
        kind: JobKind.SUGGEST_LINKS,
        status: JobStatus.DONE,
      },
    }),
  ]);
  return {
    classifiedPosts,
    embeddedPosts: Number(embeddedRows[0]?.c ?? 0),
    posts,
    suggestLinksDone,
  };
};

export {
  BACKFILL_NETWORK_PHASES,
  isBackfillNetworkPhase,
  nextBackfillNetworkPhase,
  readBackfillNetworkCounts,
};
export type { BackfillNetworkCounts, BackfillNetworkPayload, BackfillNetworkPhase };
