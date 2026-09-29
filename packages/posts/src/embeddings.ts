/**
 * Post embeddings: pgvector reads/writes. Split from index.ts so the
 * intake/state-machine module stays under the 400-line ceiling; consumers
 * keep importing from `@repo/posts` via the index re-export.
 */
import { prisma } from "@repo/db";

const EMBEDDING_DIM = 1536;

const toVectorLiteral = (v: ReadonlyArray<number>): string => `[${v.join(",")}]`;

export const recordEmbedding = async (
  postId: string,
  vector: ReadonlyArray<number>,
): Promise<void> => {
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${vector.length}`,
    );
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "Post" SET embedding = $1::vector WHERE id = $2`,
    toVectorLiteral(vector),
    postId,
  );
};

export type SimilarPost = {
  domain: string;
  id: string;
  similarity: number;
  siteId: string;
  slug: string;
  title: string;
};

export const findSimilar = async (postId: string, limit: number): Promise<Array<SimilarPost>> => {
  const rows = await prisma.$queryRaw<
    Array<{
      domain: string;
      id: string;
      similarity: number;
      site_id: string;
      slug: string;
      title: string;
    }>
  >`
    SELECT p.id, p.title, p.slug, p."siteId" AS site_id, s.domain,
           1 - (p.embedding <=> ref.embedding) AS similarity
    FROM "Post" p
    JOIN "Site" s ON s.id = p."siteId"
    JOIN "Post" ref ON ref.id = ${postId} AND ref.embedding IS NOT NULL
    WHERE p.id <> ${postId}
      AND p.embedding IS NOT NULL
    ORDER BY p.embedding <=> ref.embedding ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    domain: r.domain,
    id: r.id,
    similarity: r.similarity,
    siteId: r.site_id,
    slug: r.slug,
    title: r.title,
  }));
};

export const hasEmbedding = async (postId: string): Promise<boolean> => {
  const rows = await prisma.$queryRaw<Array<{ has: boolean }>>`
    SELECT (embedding IS NOT NULL) AS has FROM "Post" WHERE id = ${postId}
  `;
  return rows[0]?.has ?? false;
};
