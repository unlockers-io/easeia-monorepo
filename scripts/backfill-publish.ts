import { JobKind, prisma } from "@repo/db";
import { enqueue } from "@repo/jobs";

const SITE_ID = process.argv[2];
if (SITE_ID === undefined || SITE_ID === "") {
  console.error("usage: tsx scripts/backfill-publish.ts <siteId>");
  process.exit(1);
}

const REDIS_URL = process.env.REDIS_URL;
if (REDIS_URL === undefined || REDIS_URL === "") {
  console.error("REDIS_URL env var required");
  process.exit(1);
}

const run = async (): Promise<void> => {
  const site = await prisma.site.findUnique({
    select: { domain: true, id: true, vercelDeployHookUrl: true },
    where: { id: SITE_ID },
  });
  if (!site) {
    console.error(`site ${SITE_ID} not found`);
    process.exit(1);
  }
  if (site.vercelDeployHookUrl === null || site.vercelDeployHookUrl === "") {
    console.error(
      `site ${site.domain} has no vercelDeployHookUrl — set it first, otherwise PUBLISH will fail-loud for every post`,
    );
    process.exit(1);
  }

  const posts = await prisma.post.findMany({
    select: { id: true, slug: true },
    where: { siteId: SITE_ID, status: "PUBLISHED" },
  });

  console.log(`[backfill] ${posts.length} PUBLISHED posts on ${site.domain}`);

  let queued = 0;
  let failed = 0;
  for (const p of posts) {
    try {
      await enqueue({
        kind: JobKind.PUBLISH,
        payload: { postId: p.id },
        postId: p.id,
        redisUrl: REDIS_URL,
        siteId: SITE_ID,
      });
      queued += 1;
      console.log(`  ✓ ${p.slug}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${p.slug}:`, error);
    }
  }

  console.log(`[backfill] done — queued=${queued} failed=${failed}`);
  await prisma.$disconnect();
};

await run();
