import "dotenv/config";

import { JobKind, prisma } from "@repo/db";
import { closeJobs, enqueue } from "@repo/jobs";

const main = async (): Promise<number> => {
  const posts = await prisma.post.findMany({
    orderBy: { rewrittenAt: "asc" },
    select: { id: true, siteId: true, slug: true },
    where: { rewrittenAt: { not: null }, status: "PUBLISHED" },
  });

  if (posts.length === 0) {
    console.log("No rewritten posts to re-crawl.");
    return 0;
  }

  console.log(`Enqueuing CRAWL_LINKS for ${posts.length} rewritten posts…`);

  let enqueued = 0;
  let failed = 0;
  for (const post of posts) {
    try {
      await enqueue({
        kind: JobKind.CRAWL_LINKS,
        payload: { postId: post.id },
        postId: post.id,
        siteId: post.siteId,
      });
      enqueued++;
      if (enqueued % 50 === 0) {
        console.log(`  ${enqueued}/${posts.length}`);
      }
    } catch (error) {
      failed++;
      console.error(`  ✗ ${post.slug}: ${String(error)}`);
    }
  }

  console.log(`Done. enqueued=${enqueued} failed=${failed}`);
  return failed > 0 ? 1 : 0;
};

const cleanup = async (): Promise<void> => {
  await Promise.allSettled([prisma.$disconnect(), closeJobs()]);
};

try {
  const code = await main();
  await cleanup();
  process.exit(code);
} catch (error) {
  console.error(error);
  await cleanup();
  process.exit(1);
}
