import "dotenv/config";

import { type Niche, PostStatus, prisma } from "@repo/db";
import * as Sites from "@repo/sites";

const topNiches = async (siteId: string): Promise<Array<Niche>> => {
  const posts = await prisma.post.findMany({
    select: { niches: true },
    where: { niches: { isEmpty: false }, siteId, status: PostStatus.PUBLISHED },
  });

  const counts = new Map<Niche, number>();

  for (const niche of posts.flatMap((post) => post.niches)) {
    counts.set(niche, (counts.get(niche) ?? 0) + 1);
  }

  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([niche]) => niche);
};

const main = async (): Promise<void> => {
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true, niches: true },
    where: { isEnabled: true },
  });

  console.log(`Aggregating niches for ${sites.length} enabled sites…`);

  for (const site of sites) {
    const niches = await topNiches(site.id);
    await Sites.update(site.id, { niches });
    console.log(`  ${site.domain}`);
    console.log(`    before: [${site.niches.join(", ") || "—"}]`);
    console.log(`    after:  [${niches.join(", ") || "—"}]`);
  }

  console.log("Done.");
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
