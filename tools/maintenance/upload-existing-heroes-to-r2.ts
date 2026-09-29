import "dotenv/config";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { upload } from "@repo/blob";
import { prisma } from "@repo/db";
import sharp from "sharp";

const STAGING_DIR = "/tmp/easeia-images/staging-orphans";
const DRY_RUN = process.argv.includes("--dry-run");
const siteFilterArg = process.argv.find((a) => a.startsWith("--site="));
const SITE_FILTER = siteFilterArg === undefined ? null : siteFilterArg.slice("--site=".length);
const concurrencyArg = process.argv.find((a) => a.startsWith("--concurrency="));
const concurrencyRaw =
  concurrencyArg === undefined ? "" : concurrencyArg.slice("--concurrency=".length);
const CONCURRENCY = concurrencyRaw ? Math.max(1, Math.trunc(Number(concurrencyRaw))) : 8;

const EXTS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

const mimeFor = (ext: string): string => {
  switch (ext) {
    case "jpg":
    case "jpeg": {
      return "image/jpeg";
    }
    case "png": {
      return "image/png";
    }
    case "webp": {
      return "image/webp";
    }
    case "avif": {
      return "image/avif";
    }
    default: {
      throw new Error(`unknown extension: ${ext}`);
    }
  }
};

const repoNameFor = (domain: string): string => domain.replace(/\.com(?:\.br)?$/, "");

const main = async () => {
  const reposDir = process.env.REPOS_DIR?.trim();
  if (reposDir === undefined || reposDir === "") {
    throw new Error("REPOS_DIR must point to the directory containing the site repositories.");
  }
  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true },
    where: SITE_FILTER !== null && SITE_FILTER !== "" ? { domain: SITE_FILTER } : {},
  });

  console.log(`mode:           ${DRY_RUN ? "DRY-RUN" : "UPLOAD"}`);
  console.log(`sites to scan:  ${sites.length}`);

  const stats = { errors: 0, found: 0, missingPost: 0, skipped: 0, uploaded: 0 };

  for (const site of sites) {
    const repo = repoNameFor(site.domain);
    const assetsDir = join(reposDir, repo, "src/assets/posts");
    const stagingDir = join(STAGING_DIR, site.domain);

    const sources: Array<{ dir: string; label: string }> = [];
    if (existsSync(assetsDir)) {
      sources.push({ dir: assetsDir, label: "repo" });
    }
    if (existsSync(stagingDir)) {
      sources.push({ dir: stagingDir, label: "staging" });
    }

    if (sources.length === 0) {
      console.log(`\n[${site.domain}] no local images — skipping`);
      continue;
    }

    const seen = new Set<string>();
    const files: Array<{ dir: string; file: string; label: string }> = [];
    for (const src of sources) {
      for (const f of readdirSync(src.dir)) {
        const dot = f.lastIndexOf(".");
        if (dot <= 0 || !EXTS.has(f.slice(dot + 1).toLowerCase())) {
          continue;
        }
        const slug = f.slice(0, dot);
        if (seen.has(slug)) {
          continue;
        }
        seen.add(slug);
        files.push({ dir: src.dir, file: f, label: src.label });
      }
    }
    console.log(
      `\n[${site.domain}] ${files.length} local images (${sources.map((s) => s.label).join("+")})`,
    );

    const queue = [...files];
    const processOne = async ({
      dir,
      file,
    }: {
      dir: string;
      file: string;
      label: string;
    }): Promise<void> => {
      stats.found++;
      const dot = file.lastIndexOf(".");
      const slug = file.slice(0, dot);
      const ext = file.slice(dot + 1).toLowerCase();
      if (!EXTS.has(ext)) {
        return;
      }

      const post = await prisma.post.findUnique({
        select: { id: true, slug: true },
        where: { siteId_slug: { siteId: site.id, slug } },
      });
      if (!post) {
        stats.missingPost++;
        console.warn(`  [no-post]  ${file}`);
        return;
      }

      const existingHero = await prisma.postImage.findFirst({
        select: { id: true },
        where: { isHero: true, postId: post.id },
      });
      if (existingHero) {
        stats.skipped++;
        return;
      }

      const fullPath = join(dir, file);
      const bytes = readFileSync(fullPath);

      let width: number | null = null;
      let height: number | null = null;
      try {
        const meta = await sharp(bytes).metadata();
        width = meta.width;
        height = meta.height;
      } catch (error) {
        console.warn(
          `  [no-meta]  ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (DRY_RUN) {
        stats.uploaded++;
        return;
      }

      try {
        const result = await upload({
          bytes: new Uint8Array(bytes),
          filename: file,
          mime: mimeFor(ext),
          postId: post.id,
          siteId: site.id,
        });
        await prisma.$transaction([
          prisma.postImage.create({
            data: {
              alt: null,
              blobKey: result.key,
              blobUrl: result.url,
              filename: file,
              height,
              isHero: true,
              mime: mimeFor(ext),
              postId: post.id,
              width,
            },
          }),
          prisma.post.update({
            data: { featuredImage: result.url },
            where: { id: post.id },
          }),
        ]);
        stats.uploaded++;
        if (stats.uploaded % 25 === 0) {
          console.log(`  [progress] ${stats.uploaded} uploaded`);
        }
      } catch (error) {
        stats.errors++;
        console.error(
          `  [error]    ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) {
          return;
        }
        await processOne(next);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  }

  console.log(`\n=== summary ===`);
  console.log(`found:       ${stats.found}`);
  console.log(`uploaded:    ${stats.uploaded}`);
  console.log(`skipped:     ${stats.skipped} (post already has hero PostImage)`);
  console.log(`no-post:     ${stats.missingPost} (slug not in DB)`);
  console.log(`errors:      ${stats.errors}`);

  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
