import { writeFile } from "node:fs/promises";

import { mintApiKeyToken } from "@repo/api-types";
import { prisma } from "@repo/db";

type Output = {
  domain: string;
  siteId: string;
  token: string;
  vercelProject: string;
};

const main = async () => {
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true },
    where: { isEnabled: true },
  });

  const out: Array<Output> = [];

  for (const site of sites) {
    const name = `${site.domain} build`;
    const existing = await prisma.apiKey.findFirst({
      where: { name, revokedAt: null, siteId: site.id },
    });
    if (existing) {
      console.log(`  skip ${site.domain} — key "${name}" already exists (id=${existing.id})`);
      continue;
    }
    const { hash, prefix, token } = mintApiKeyToken();
    await prisma.apiKey.create({
      data: {
        hash,
        name,
        prefix,
        scopes: ["content:read"],
        siteId: site.id,
      },
    });
    out.push({
      domain: site.domain,
      siteId: site.id,
      token,
      vercelProject: site.domain.split(".")[0] ?? site.domain,
    });
    console.log(`  issued ${site.domain} → ${token.slice(0, 16)}...`);
  }

  const path = "/tmp/easeia-site-keys.json";
  await writeFile(path, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${out.length} new keys to ${path}`);
  console.log(`(${sites.length - out.length} sites already had keys)`);
  await prisma.$disconnect();
};

await main();
