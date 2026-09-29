import "dotenv/config";

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@repo/db";
import { z } from "zod";

const MANIFEST_DIR = "/tmp/easeia-images/manifests";
const OUT_DIR = "/tmp/easeia-images/orphans";

type ManifestEntry = { file: string; post_id: number; slug: string; title: string };

const manifestEntrySchema: z.ZodType<ManifestEntry> = z.object({
  file: z.string(),
  post_id: z.number(),
  slug: z.string(),
  title: z.string(),
});

const main = async () => {
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true, niches: true },
  });

  let total = 0;
  const summary: Array<{ count: number; domain: string }> = [];

  for (const site of sites) {
    const manifestPath = join(MANIFEST_DIR, `${site.domain}.json`);
    const manifest = z
      .array(manifestEntrySchema)
      .parse(JSON.parse(readFileSync(manifestPath, "utf8")));
    const withWpImage = new Set(manifest.map((e) => e.slug));

    const posts = await prisma.post.findMany({
      orderBy: { slug: "asc" },
      select: {
        categories: true,
        excerpt: true,
        focusKeyword: true,
        slug: true,
        tags: true,
        title: true,
      },
      where: { siteId: site.id, status: "PUBLISHED" },
    });

    const orphans = posts.filter((p) => !withWpImage.has(p.slug));
    writeFileSync(
      join(OUT_DIR, `${site.domain}.json`),
      JSON.stringify(
        {
          domain: site.domain,
          niches: site.niches,
          orphans: orphans.map((p) => ({
            categories: p.categories,
            excerpt: p.excerpt,
            focusKeyword: p.focusKeyword,
            slug: p.slug,
            tags: p.tags,
            title: p.title,
          })),
        },
        undefined,
        2,
      ),
    );
    summary.push({ count: orphans.length, domain: site.domain });
    total += orphans.length;
  }

  console.log(`=== orphans per site ===`);
  for (const s of summary) {
    console.log(`  ${s.domain.padEnd(28)} ${s.count}`);
  }
  console.log(`\ntotal orphans: ${total}`);

  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
