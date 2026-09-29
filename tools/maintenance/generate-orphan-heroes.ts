import "dotenv/config";

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@repo/db";
import { generateHero } from "@repo/hero";
import { z } from "zod";

const ORPHAN_DIR = "/tmp/easeia-images/orphans";
const LOG_DIR = "/tmp/easeia-images/orphans-run";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (OPENAI_API_KEY === undefined || OPENAI_API_KEY === "") {
  console.error("OPENAI_API_KEY not set");
  process.exit(1);
}

type Orphan = {
  categories: Array<string>;
  excerpt: string | null;
  focusKeyword: string | null;
  slug: string;
  tags: Array<string>;
  title: string;
};

type SiteFile = { domain: string; niches: Array<string>; orphans: Array<Orphan> };

const orphanSchema: z.ZodType<Orphan> = z.object({
  categories: z.array(z.string()),
  excerpt: z.string().nullable(),
  focusKeyword: z.string().nullable(),
  slug: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
});

const siteFileSchema: z.ZodType<SiteFile> = z.object({
  domain: z.string(),
  niches: z.array(z.string()),
  orphans: z.array(orphanSchema),
});

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const main = async (): Promise<void> => {
  mkdirSync(LOG_DIR, { recursive: true });

  const sites = await prisma.site.findMany({
    select: { domain: true, id: true, imageStyle: true },
  });
  const siteByDomain = new Map(sites.map((s) => [s.domain, s] as const));

  type Task = {
    domain: string;
    imageStyle: string | null;
    orphan: Orphan;
    postId: string;
    siteId: string;
  };
  const tasks: Array<Task> = [];

  for (const f of readdirSync(ORPHAN_DIR).filter((n) => n.endsWith(".json"))) {
    const siteFilePath = join(ORPHAN_DIR, f);
    const siteFileJson: unknown = JSON.parse(readFileSync(siteFilePath, "utf8"));
    const data = siteFileSchema.parse(siteFileJson);
    const site = siteByDomain.get(data.domain);
    if (!site) {
      console.warn(
        `[gen] no site row for ${data.domain} — skipping ${data.orphans.length} orphans`,
      );
      continue;
    }
    const posts = await prisma.post.findMany({
      select: { id: true, slug: true },
      where: { siteId: site.id, slug: { in: data.orphans.map((o) => o.slug) } },
    });
    const postBySlug = new Map(posts.map((p) => [p.slug, p.id] as const));
    for (const o of data.orphans) {
      const postId = postBySlug.get(o.slug);
      if (postId === undefined || postId === "") {
        console.warn(`[gen] no post row for ${data.domain}/${o.slug}`);
        continue;
      }
      tasks.push({
        domain: data.domain,
        imageStyle: site.imageStyle,
        orphan: o,
        postId,
        siteId: site.id,
      });
    }
  }
  console.log(`[gen] total orphans: ${tasks.length}`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ domain: string; err: string; slug: string }> = [];

  for (const task of tasks) {
    let existing: { id: string } | null;
    try {
      existing = await prisma.postImage.findFirst({
        select: { id: true },
        where: { isHero: true, postId: task.postId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[gen] skip-check failed for ${task.domain}/${task.orphan.slug}: ${message}`);
      skipped++;
      await sleep(2000);
      continue;
    }
    if (existing) {
      skipped++;
      continue;
    }

    try {
      await generateHero({
        post: {
          categories: task.orphan.categories,
          id: task.postId,
          siteId: task.siteId,
          slug: task.orphan.slug,
          tags: task.orphan.tags,
          title: task.orphan.title,
        },
        site: { imageStyle: task.imageStyle },
      });
      generated++;
      if (generated % 10 === 0) {
        console.log(
          `[gen] ${generated}/${tasks.length - skipped} (skipped ${skipped}, failed ${failed})`,
        );
      }
      await sleep(1500);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ domain: task.domain, err: message, slug: task.orphan.slug });
      console.warn(`[gen] FAIL ${task.domain}/${task.orphan.slug}: ${message}`);
      await sleep(5000);
    }
  }

  writeFileSync(`${LOG_DIR}/failures.json`, JSON.stringify(failures, undefined, 2));
  console.log(
    `\n[gen] done — generated=${generated} skipped=${skipped} failed=${failed} (failures.json written)`,
  );
  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
