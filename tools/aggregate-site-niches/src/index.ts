import "dotenv/config";

import { prisma } from "@repo/db";
import { aggregateSiteNiches } from "@repo/sites";

const main = async (): Promise<void> => {
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true, niches: true },
    where: { isEnabled: true },
  });

  console.log(`Aggregating niches for ${sites.length} enabled sites…`);

  for (const site of sites) {
    const before = site.niches;
    const after = await aggregateSiteNiches(site.id);
    console.log(`  ${site.domain}`);
    console.log(`    before: [${before.join(", ") || "—"}]`);
    console.log(`    after:  [${after.join(", ") || "—"}]`);
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
