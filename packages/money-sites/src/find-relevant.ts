import { type Niche, prisma } from "@repo/db";

export type RelevantPage = {
  id: string;
  niches: ReadonlyArray<Niche>;
  similarity: number;
  title: string;
  url: string;
};

export type CandidateRow = RelevantPage;

export const filterByNiche = (
  candidates: ReadonlyArray<CandidateRow>,
  postNiches: ReadonlyArray<Niche>,
): Array<CandidateRow> => {
  if (postNiches.length === 0) {
    return [...candidates];
  }
  const set = new Set<string>(postNiches);
  return candidates.filter((c) => c.niches.some((n) => set.has(n)));
};

type Row = {
  id: string;
  niches: ReadonlyArray<Niche>;
  similarity: number;
  title: string;
  url: string;
};

export const findRelevantPages = async (
  postId: string,
  limit: number,
): Promise<Array<RelevantPage>> => {
  const post = await prisma.post.findUnique({
    include: { site: true },
    where: { id: postId },
  });
  if (post === null) {
    return [];
  }
  const { moneySiteId } = post.site;
  if (moneySiteId === null) {
    return [];
  }
  const rows = await prisma.$queryRaw<Array<Row>>`
    SELECT mp.id,
           mp.url,
           mp.title,
           mp.niches::text[] AS niches,
           1 - (mp.embedding <=> p.embedding) AS similarity
    FROM "MoneySitePage" mp
    JOIN "Post" p ON p.id = ${postId} AND p.embedding IS NOT NULL
    WHERE mp."moneySiteId" = ${moneySiteId}
      AND mp.embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT ${limit * 3}
  `;
  const filtered = filterByNiche(rows, post.niches);
  return filtered.slice(0, limit).map((r) => ({
    id: r.id,
    niches: r.niches,
    similarity: r.similarity,
    title: r.title,
    url: r.url,
  }));
};
