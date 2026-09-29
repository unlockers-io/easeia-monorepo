import "dotenv/config";

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

import { JobKind, prisma } from "@repo/db";
import { closeJobs, enqueue } from "@repo/jobs";
import { dedupeBody } from "@repo/posts";
import { z } from "zod";

import { AFFECTED_SITES_FILE, recordAffectedSites } from "../_shared/affected-sites";

import { classify, type Classified } from "./classify";
import { printReport, type Repair, type Row } from "./report";

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const value = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const positiveInt = (raw: string | undefined, fallback: number, name: string): number => {
  if (raw === undefined) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--${name} needs a positive integer, got ${JSON.stringify(raw)}`);
  }
  return n;
};

const ACCEPT_SUPERSEDED = flag("accept-superseded");
const APPLY = flag("apply");
const DEPLOY = flag("deploy");
const REEMBED = flag("reembed");
const RESTORE_FILE = value("restore");
const BATCH_SIZE = positiveInt(value("batch"), 20, "batch");

const CANDIDATE_IDS_SQL = `
  SELECT p.id
  FROM "Post" p,
  LATERAL (
    SELECT count(*) AS total, count(DISTINCT b) AS distinct_blocks
    FROM regexp_split_to_table(p.body, '\\n[[:space:]]*\\n') AS b
    WHERE length(btrim(b)) >= 80
  ) s
  WHERE s.total - s.distinct_blocks >= 1
  ORDER BY p.id
`;

const SELECT = {
  body: true,
  id: true,
  site: { select: { domain: true } },
  siteId: true,
  slug: true,
  status: true,
} as const;

const fetchCandidateIds = async (): Promise<Array<string>> => {
  const rows = await prisma.$queryRawUnsafe<ReadonlyArray<{ id: string }>>(CANDIDATE_IDS_SQL);
  return rows.map((r) => r.id);
};

const backupLineSchema = z.object({
  /**
   * The audit record of which rows took the weaker path. Defaulted rather than
   * required so backup files written before `--accept-superseded` existed still
   * restore, and false is the truth for them: nothing else could be written then.
   */
  acceptedSuperseded: z.boolean().default(false),
  before: z.string().min(1),
  postId: z.string().min(1),
  site: z.string(),
  slug: z.string(),
});

type BackupLine = z.infer<typeof backupLineSchema>;

/** Host only, so a connection string never reaches a log or a report. */
const dbHost = (): string => {
  const raw = process.env.DATABASE_URL;
  if (raw === undefined || raw === "") {
    return "an unset DATABASE_URL";
  }
  try {
    return new URL(raw).host;
  } catch {
    return "an unparseable DATABASE_URL";
  }
};

const backupPath = (): string =>
  `./dedupe-bodies-backup-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.jsonl`;

const writeBackup = (path: string, repairs: ReadonlyArray<Repair>): void => {
  const lines = repairs.map((r) => {
    const entry: BackupLine = {
      acceptedSuperseded: r.method === "would-drop",
      before: r.before,
      postId: r.postId,
      site: r.site,
      slug: r.slug,
    };
    return JSON.stringify(entry);
  });
  appendFileSync(path, lines.length === 0 ? "" : `${lines.join("\n")}\n`, "utf8");
};

const applyBatch = async (repairs: ReadonlyArray<Repair>, path: string): Promise<void> => {
  const settled = await Promise.allSettled(
    repairs.map((r) => prisma.post.update({ data: { body: r.after }, where: { id: r.postId } })),
  );
  const failures = settled.filter((s) => s.status === "rejected");
  const first = failures.at(0);
  if (first !== undefined) {
    throw new Error(
      `${failures.length} of ${settled.length} post updates failed. Every original is in ${path}; undo with \`pnpm dedupe:bodies --restore ${path}\`. First error: ${String(first.reason)}`,
    );
  }
};

const restore = async (path: string): Promise<void> => {
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "");

  const entries: Array<BackupLine> = [];
  let unreadable = 0;
  for (const line of lines) {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      unreadable++;
      console.error(`  [SKIP] unparseable backup line: ${line.slice(0, 80)}`);
      continue;
    }
    const parsed = backupLineSchema.safeParse(raw);
    if (parsed.success) {
      entries.push(parsed.data);
      continue;
    }
    unreadable++;
    console.error(`  [SKIP] backup line missing fields: ${line.slice(0, 80)}`);
  }

  const weaker = entries.filter((e) => e.acceptedSuperseded);
  console.log(
    `restoring ${entries.length} bodies from ${path}` +
      ` (${weaker.length} of them written under --accept-superseded)`,
  );
  for (const entry of weaker) {
    console.log(`  [accept-superseded] ${entry.site}/${entry.slug}`);
  }
  const settled = await Promise.allSettled(
    entries.map((entry) =>
      prisma.post.update({ data: { body: entry.before }, where: { id: entry.postId } }),
    ),
  );
  const failed = settled.filter((s) => s.status === "rejected").length;
  for (const [i, result] of settled.entries()) {
    if (result.status === "rejected") {
      console.error(`  [FAIL] ${entries[i]?.slug ?? "?"}: ${String(result.reason)}`);
    }
  }
  console.log(`restored ${settled.length - failed} posts, ${failed} failed, ${unreadable} skipped`);
  if (failed > 0 || unreadable > 0) {
    throw new Error(`restore incomplete: ${failed} failed, ${unreadable} unreadable`);
  }
};

const triggerDeploys = async (siteIds: ReadonlySet<string>): Promise<void> => {
  const sites = await prisma.site.findMany({
    select: { domain: true, vercelDeployHookUrl: true },
    where: { id: { in: [...siteIds] } },
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

const enqueueReembeds = async (postIds: ReadonlyArray<string>): Promise<void> => {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl === undefined || redisUrl === "") {
    throw new Error("--reembed needs REDIS_URL to enqueue EMBED jobs");
  }
  const settled = await Promise.allSettled(
    postIds.map((postId) =>
      enqueue({ kind: JobKind.EMBED, payload: { postId }, postId, redisUrl }),
    ),
  );
  const failed = settled.filter((s) => s.status === "rejected").length;
  console.log(`\nenqueued ${settled.length - failed} EMBED jobs, ${failed} failed`);
};

const writtenRows = (c: Classified): Array<Repair> => [...c.writable, ...c.acceptedSuperseded];

const main = async (): Promise<void> => {
  if (RESTORE_FILE !== undefined) {
    await restore(RESTORE_FILE);
    return;
  }

  const candidateIds = await fetchCandidateIds();
  console.log(
    `probe matched ${candidateIds.length} candidate posts (${APPLY ? "APPLY" : "dry run"})`,
  );

  const classified: Classified = {
    acceptedSuperseded: [],
    nearMisses: [],
    needsReview: [],
    rejected: [],
    writable: [],
  };
  const path = backupPath();
  if (APPLY) {
    writeFileSync(path, "", "utf8");
  }

  try {
    for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
      const ids = candidateIds.slice(i, i + BATCH_SIZE);
      const rows: Array<Row> = await prisma.post.findMany({
        select: SELECT,
        where: { id: { in: ids } },
      });

      const batch = classify(rows, classified, {
        acceptSuperseded: ACCEPT_SUPERSEDED,
        dedupe: dedupeBody,
      });

      if (!APPLY || batch.length === 0) {
        continue;
      }
      writeBackup(path, batch);
      await applyBatch(batch, path);
    }
  } finally {
    printReport(classified);
    if (APPLY) {
      const written = writtenRows(classified);
      const affectedSiteIds = new Set(written.map((r) => r.siteId));
      const domains = [...new Set(written.map((r) => r.site))].toSorted();
      recordAffectedSites([...affectedSiteIds]);
      console.log(
        `\nwrote ${written.length} bodies, ${classified.acceptedSuperseded.length} of them under` +
          ` --accept-superseded. Originals: ${path}`,
      );
      console.log(`Undo with: pnpm dedupe:bodies --restore ${path}`);
      console.log(`${affectedSiteIds.size} affected site ids -> ${AFFECTED_SITES_FILE}`);
      console.log(`  ${domains.join(", ")}`);
      console.log(
        `  ids are only valid against ${dbHost()}. Redeploy before running this tool again,`,
      );
      console.log(`  or recover the list from the "site" field in ${path}.`);
    }
  }

  if (!APPLY) {
    console.log("\ndry run: nothing written. Re-run with --apply to write.");
    return;
  }

  if (REEMBED) {
    await enqueueReembeds(writtenRows(classified).map((r) => r.postId));
  } else {
    console.log("\nPost.embedding left as-is. Pass --reembed to enqueue an EMBED job per body.");
  }

  if (DEPLOY) {
    await triggerDeploys(new Set(writtenRows(classified).map((r) => r.siteId)));
  } else {
    console.log("\nThe 12 Astro blogs build this copy in. Re-run with --deploy, or run");
    console.log("`tsx tools/maintenance/redeploy-affected-sites.ts`, to publish the change.");
  }
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([prisma.$disconnect(), closeJobs()]);
}
