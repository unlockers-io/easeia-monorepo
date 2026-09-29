import "dotenv/config";

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

import { JobKind, prisma } from "@repo/db";
import { enqueue } from "@repo/jobs";
import { hasEmDash, stripEmDash, type StripKind } from "@repo/posts";
import { z } from "zod";

import { collectPreviewChanges } from "./preview";
import { type Change, FIELDS, type Field, printReport } from "./report";

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const value = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const APPLY = flag("apply");
const PREVIEW = flag("preview");
const DEPLOY = flag("deploy");
const REEMBED = flag("reembed");
const RESTORE_FILE = value("restore");
const BATCH_SIZE = Number(value("batch") ?? 200);
const PREVIEW_BODIES_PER_SITE = Number(value("preview-limit") ?? 40);

const KIND_OF: Record<Field, StripKind> = {
  body: "markdown",
  excerpt: "text",
  focusKeyword: "text",
  title: "title",
};

type Row = {
  body: string;
  excerpt: string | null;
  focusKeyword: string | null;
  id: string;
  site: { domain: string };
  siteId: string;
  slug: string;
  status: string;
  title: string;
};

const SELECT = {
  body: true,
  excerpt: true,
  focusKeyword: true,
  id: true,
  site: { select: { domain: true } },
  siteId: true,
  slug: true,
  status: true,
  title: true,
} as const;

const changesFor = (row: Row): Array<Change> => {
  const out: Array<Change> = [];
  for (const field of FIELDS) {
    const current = row[field];
    if (!hasEmDash(current)) {
      continue;
    }
    const result = stripEmDash(current, KIND_OF[field]);
    if (!result.changed) {
      continue;
    }
    out.push({
      after: result.text,
      before: current,
      counts: result.counts,
      field,
      postId: row.id,
      site: row.site.domain,
      slug: row.slug,
      status: row.status,
    });
  }
  return out;
};

const scanPosts = async (onBatch: (rows: Array<Row>) => Promise<void>): Promise<number> => {
  let cursor: string | undefined;
  let scanned = 0;
  for (;;) {
    const query = {
      orderBy: { id: "asc" },
      select: SELECT,
      take: BATCH_SIZE,
    } as const;
    const rows: Array<Row> =
      cursor === undefined
        ? await prisma.post.findMany(query)
        : await prisma.post.findMany({ ...query, cursor: { id: cursor }, skip: 1 });
    if (rows.length === 0) {
      break;
    }
    scanned += rows.length;
    await onBatch(rows);
    cursor = rows.at(-1)?.id;
  }
  return scanned;
};

type BackupLine = { before: string; field: Field; postId: string; site: string; slug: string };

const backupLineSchema: z.ZodType<BackupLine> = z.object({
  before: z.string(),
  field: z.enum(FIELDS),
  postId: z.string(),
  site: z.string(),
  slug: z.string(),
});

const backupPath = (): string =>
  `./em-dash-backup-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.jsonl`;

const writeBackup = (path: string, changes: Array<Change>): void => {
  const lines = changes.map((c) => {
    const entry: BackupLine = {
      before: c.before,
      field: c.field,
      postId: c.postId,
      site: c.site,
      slug: c.slug,
    };
    return JSON.stringify(entry);
  });
  appendFileSync(path, lines.length === 0 ? "" : `${lines.join("\n")}\n`, "utf8");
};

const applyBatch = async (changes: Array<Change>): Promise<void> => {
  const byPost = new Map<string, Partial<Record<Field, string>>>();
  for (const c of changes) {
    const patch = byPost.get(c.postId) ?? {};
    patch[c.field] = c.after;
    byPost.set(c.postId, patch);
  }
  const writes = [...byPost].map(([id, data]) => prisma.post.update({ data, where: { id } }));
  const settled = await Promise.allSettled(writes);
  const failures = settled.filter((r) => r.status === "rejected");
  const first = failures.at(0);
  if (first !== undefined) {
    throw new Error(
      `${failures.length} of ${settled.length} post updates failed; the backup file holds every original. First error: ${String(first.reason)}`,
    );
  }
};

const restore = async (path: string): Promise<void> => {
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "");
  console.log(`restoring ${lines.length} field values from ${path}`);
  const byPost = new Map<string, Partial<Record<Field, string>>>();
  for (const line of lines) {
    const entry = backupLineSchema.parse(JSON.parse(line));
    const patch = byPost.get(entry.postId) ?? {};
    patch[entry.field] = entry.before;
    byPost.set(entry.postId, patch);
  }
  const settled = await Promise.allSettled(
    [...byPost].map(([id, data]) => prisma.post.update({ data, where: { id } })),
  );
  const failed = settled.filter((r) => r.status === "rejected").length;
  console.log(`restored ${settled.length - failed} posts, ${failed} failed`);
};

const triggerDeploys = async (siteDomains: Set<string>): Promise<void> => {
  const sites = await prisma.site.findMany({
    select: { domain: true, vercelDeployHookUrl: true },
    where: { domain: { in: [...siteDomains] } },
  });
  console.log("\ndeploy hooks");
  for (const site of sites) {
    const hook = site.vercelDeployHookUrl;
    if (hook === null || hook === "") {
      console.log(`  [SKIP] ${site.domain.padEnd(30)} no deploy hook configured`);
      continue;
    }
    try {
      const res = await fetch(hook, { method: "POST" });
      console.log(`  [${res.ok ? "OK" : "FAIL"}] ${site.domain.padEnd(30)} HTTP ${res.status}`);
    } catch (error) {
      console.log(`  [FAIL] ${site.domain.padEnd(30)} ${String(error)}`);
    }
  }
};

const enqueueReembeds = async (postIds: Array<string>, redisUrl: string): Promise<void> => {
  const settled = await Promise.allSettled(
    postIds.map((postId) =>
      enqueue({ kind: JobKind.EMBED, payload: { postId }, postId, redisUrl }),
    ),
  );
  const failed = settled.filter((r) => r.status === "rejected").length;
  console.log(`\nenqueued ${settled.length - failed} EMBED jobs, ${failed} failed`);
};

const main = async (): Promise<void> => {
  if (RESTORE_FILE !== undefined) {
    await restore(RESTORE_FILE);
    return;
  }

  if (PREVIEW) {
    const { changes, coverage } = await collectPreviewChanges(PREVIEW_BODIES_PER_SITE);
    printReport(changes, coverage);
    console.log("\npreview only: read from the live blogs, no database touched.");
    console.log("\n!! The live blogs are NOT a representative sample of the database. They render");
    console.log("!! only PUBLISHED posts, and rendered HTML hides the shapes that dominate the");
    console.log("!! real rule mix. Measured against production the two disagree by a factor of");
    console.log("!! 50 on some rules. Use --preview to eyeball the rewrite, never to size it.");
    console.log("!! Run the dry run against the database for real proportions.");
    return;
  }

  const all: Array<Change> = [];
  const path = backupPath();
  if (APPLY) {
    writeFileSync(path, "", "utf8");
  }

  const scanned = await scanPosts(async (rows) => {
    const batch = rows.flatMap(changesFor);
    if (batch.length === 0) {
      return;
    }
    all.push(...batch);
    if (!APPLY) {
      return;
    }
    writeBackup(path, batch);
    await applyBatch(batch);
  });

  printReport(all, { bodiesRead: scanned, scanned });

  if (!APPLY) {
    console.log("\ndry run: nothing written. Re-run with --apply to write.");
    return;
  }

  console.log(`\nwrote ${all.length} field values. Originals: ${path}`);
  console.log(`Undo with: pnpm strip:em-dashes --restore ${path}`);

  if (REEMBED) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl === undefined || redisUrl === "") {
      throw new Error("--reembed needs REDIS_URL to enqueue EMBED jobs");
    }
    await enqueueReembeds(
      [...new Set(all.flatMap((change) => (change.field === "body" ? [change.postId] : [])))],
      redisUrl,
    );
  } else {
    console.log("\nPost.embedding left as-is: punctuation does not move a vector meaningfully.");
    console.log("Pass --reembed to enqueue an EMBED job per touched body.");
  }

  if (DEPLOY) {
    await triggerDeploys(new Set(all.map((c) => c.site)));
  } else {
    console.log("\nThe 12 Astro blogs build this copy in. Re-run with --deploy, or POST each");
    console.log("Site.vercelDeployHookUrl by hand, to publish the change.");
  }
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
