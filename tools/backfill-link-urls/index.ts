import "dotenv/config";

import { prisma } from "@repo/db";
import { postPublicUrl } from "@repo/sites";

const main = async (): Promise<number> => {
  const links = await prisma.link.findMany({
    select: {
      id: true,
      toPost: {
        select: {
          categories: true,
          site: { select: { categorySlugMap: true, defaultCategory: true, domain: true } },
          slug: true,
        },
      },
      toUrl: true,
    },
    where: { toPostId: { not: null } },
  });

  console.log(`Inspecting ${links.length} resolved link${links.length === 1 ? "" : "s"}…`);

  let updated = 0;
  for (const link of links) {
    if (!link.toPost) {
      continue;
    }
    const next = postPublicUrl(link.toPost.site, link.toPost);
    if (next === link.toUrl) {
      continue;
    }
    await prisma.link.update({ data: { toUrl: next }, where: { id: link.id } });
    updated += 1;
  }

  console.log(`Done. ${updated} link${updated === 1 ? "" : "s"} rewritten.`);
  return 0;
};

try {
  const code = await main();
  await prisma.$disconnect();
  process.exit(code);
} catch (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
