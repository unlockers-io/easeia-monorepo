/**
 * Dry-run by default; --apply restamps the posts a single bulk publish left
 * sharing one timestamp, spacing them across the days since. Writes the old
 * values to --backup first, and refuses any date earlier than its createdAt.
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";

import { prisma } from "@repo/db";

import { redeploySites } from "../_shared/redeploy";

const APPLY = process.argv.includes("--apply");
const DOMAIN = "aquelecurta.com";
const CLUSTER_DAY = "2026-05-27";
const DAY_MS = 86_400_000;

const backupPath = (): string =>
  process.argv[process.argv.indexOf("--backup") + 1] ??
  `${process.env.HOME}/.cache/easeia-work/${DOMAIN}-publishedAt-backup.json`;

const dayOf = (value: Date | null): string =>
  value ? new Date(value).toISOString().slice(0, 10) : "none";

const main = async (): Promise<void> => {
  const site = await prisma.site.findFirst({ select: { id: true }, where: { domain: DOMAIN } });

  if (!site) {
    throw new Error(`no site ${DOMAIN}`);
  }

  const posts = await prisma.post.findMany({
    orderBy: { slug: "asc" },
    select: { createdAt: true, id: true, publishedAt: true, slug: true },
    where: { siteId: site.id, status: "PUBLISHED" },
  });

  const cluster = posts.filter((post) => dayOf(post.publishedAt) === CLUSTER_DAY);

  if (cluster.length === 0) {
    console.log("nothing to restamp");

    return;
  }

  const start = new Date(`${CLUSTER_DAY}T00:00:00.000Z`).getTime();
  const span = Math.floor((Date.now() - start) / DAY_MS);
  const step = span / cluster.length;

  const planned = cluster.map((post, index) => ({
    at: new Date(
      start +
        Math.floor(index * step) * DAY_MS +
        ((index * 7) % 24) * 3_600_000 +
        ((index * 13) % 60) * 60_000,
    ),
    createdAt: post.createdAt,
    id: post.id,
    slug: post.slug,
    was: post.publishedAt,
  }));

  for (const post of planned) {
    if (post.at.getTime() < new Date(post.createdAt).getTime()) {
      throw new Error(`refusing ${post.slug}: ${dayOf(post.at)} precedes createdAt`);
    }
  }

  console.log(`${DOMAIN}: ${cluster.length} posts share ${CLUSTER_DAY}`);
  console.log(`spreading across ${span} days, one every ${step.toFixed(2)} days`);
  console.log(`first ${dayOf(planned[0]?.at ?? null)}   last ${dayOf(planned.at(-1)?.at ?? null)}`);

  for (const post of planned.slice(0, 4)) {
    console.log(`  ${post.at.toISOString().slice(0, 16)}  /${post.slug.slice(0, 46)}`);
  }

  if (!APPLY) {
    console.log("\ndry run; pass --apply to write");

    return;
  }

  const path = backupPath();
  writeFileSync(
    path,
    JSON.stringify(
      posts.map((post) => ({ id: post.id, publishedAt: post.publishedAt, slug: post.slug })),
      null,
      2,
    ),
  );
  console.log(`\nbacked up ${posts.length} values -> ${path}`);

  for (const post of planned) {
    await prisma.post.update({ data: { publishedAt: post.at }, where: { id: post.id } });
  }

  await redeploySites([site.id]);
  console.log(`restamped ${planned.length} posts; ${DOMAIN} redeployed`);
};

await main();

await prisma.$disconnect();
