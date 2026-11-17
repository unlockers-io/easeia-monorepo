import { PostStatus, type PrismaClient } from "@repo/db";
import { approveSuggestions, suggestLink } from "@repo/links";

const SIM_LIMIT = 8;
const MAX_NEW_PER_SOURCE = 3;

export type ListedPost = {
  categories: Array<string>;
  excerpt: string | null;
  id: string;
  siteId: string;
  slug: string;
  title: string;
};

export type LinkFix = { orphanId: string; siteId: string; sourceId: string };

type SourceCandidate = { body: string; id: string };

const similarSources = async (
  prisma: PrismaClient,
  orphanId: string,
  siteId: string,
): Promise<Array<SourceCandidate>> =>
  prisma.$queryRawUnsafe<Array<SourceCandidate>>(
    `
    SELECT p.id, p.body
    FROM "Post" p
    JOIN "Post" ref ON ref.id = $1 AND ref.embedding IS NOT NULL
    WHERE p.id <> $1
      AND p.status = 'PUBLISHED'
      AND p."siteId" = $2
      AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> ref.embedding
    LIMIT $3
    `,
    orphanId,
    siteId,
    SIM_LIMIT,
  );

const fallbackSources = async (
  prisma: PrismaClient,
  orphan: ListedPost,
): Promise<Array<SourceCandidate>> => {
  const rows = await prisma.post.findMany({
    orderBy: { publishedAt: "desc" },
    select: { body: true, categories: true, id: true },
    take: SIM_LIMIT,
    where: {
      id: { not: orphan.id },
      siteId: orphan.siteId,
      status: PostStatus.PUBLISHED,
    },
  });

  const sharesCategory = (post: { categories: Array<string> }): number =>
    post.categories.some((c) => orphan.categories.includes(c)) ? 1 : 0;

  return rows.toSorted((a, b) => sharesCategory(b) - sharesCategory(a));
};

const pickSource = async (
  prisma: PrismaClient,
  orphan: ListedPost,
  addedBySource: ReadonlyMap<string, number>,
): Promise<SourceCandidate | undefined> => {
  const similar = await similarSources(prisma, orphan.id, orphan.siteId);
  const candidates = similar.length > 0 ? similar : await fallbackSources(prisma, orphan);

  return candidates.find(
    (candidate) =>
      (addedBySource.get(candidate.id) ?? 0) < MAX_NEW_PER_SOURCE &&
      !candidate.body.includes(orphan.slug),
  );
};

export const planInboundFixes = async (
  prisma: PrismaClient,
  orphans: ReadonlyArray<ListedPost>,
): Promise<Array<LinkFix>> => {
  const addedBySource = new Map<string, number>();
  const planned: Array<LinkFix> = [];

  for (const orphan of orphans) {
    const picked = await pickSource(prisma, orphan, addedBySource);

    if (picked === undefined) {
      continue;
    }

    addedBySource.set(picked.id, (addedBySource.get(picked.id) ?? 0) + 1);
    planned.push({ orphanId: orphan.id, siteId: orphan.siteId, sourceId: picked.id });
  }

  return planned;
};

export const applyInboundFix = async (prisma: PrismaClient, fix: LinkFix): Promise<void> => {
  const link = await suggestLink(prisma, fix.sourceId, fix.orphanId);
  await approveSuggestions(prisma, fix.sourceId, [link.id]);
};
