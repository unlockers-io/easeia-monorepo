import { readFile } from "node:fs/promises";

import { prisma } from "@repo/db";
import { z } from "zod";

type RolloutResult = {
  astroRepoUrl: string;
  domain: string;
  hook: string;
  project: string;
  siteId: string;
};

const rolloutResultSchema: z.ZodType<RolloutResult> = z.object({
  astroRepoUrl: z.url({ protocol: /^https?$/ }),
  domain: z.string(),
  hook: z.string(),
  project: z.string(),
  siteId: z.string(),
});

const main = async () => {
  const raw: unknown = JSON.parse(await readFile("/tmp/rollout-results.json", "utf8"));
  const results = z.array(rolloutResultSchema).parse(raw);

  for (const r of results) {
    await prisma.site.update({
      data: {
        astroRepoUrl: r.astroRepoUrl,
        vercelDeployHookUrl: r.hook,
        vercelProjectName: r.project,
      },
      where: { id: r.siteId },
    });
    console.log(`  ✓ ${r.domain.padEnd(28)} hook + project + repo set`);
  }

  await prisma.$disconnect();
};

await main();
