import "dotenv/config";

import { requireProvider, REWRITE_MODEL as REPAIR_MODEL } from "@repo/ai";
import { prisma } from "@repo/db";
import { normalizeBody } from "@repo/posts";
import { generateText } from "ai";

import { AFFECTED_SITES_FILE, recordAffectedSites } from "../_shared/affected-sites";

const BATCH_SIZE = 5;

const APPLY = process.argv.includes("--apply");

type Row = {
  body: string;
  id: string;
  siteId: string;
  slug: string;
  status: string;
};

const selectCorrupted = (): Promise<ReadonlyArray<Row>> =>
  prisma.$queryRawUnsafe<ReadonlyArray<Row>>(`
    SELECT id, "siteId", slug, status, body
    FROM "Post"
    WHERE position(chr(10) in body) = 0
       OR position('\\*' in body) > 0
       OR position('\\#' in body) > 0
    ORDER BY "siteId", slug
  `);

const buildPrompt = (body: string): string =>
  [
    "You repair corrupted Markdown. A blog post's Markdown body lost all its line",
    "breaks and had its Markdown punctuation backslash-escaped by a faulty",
    "HTML→Markdown conversion. Restore correct Markdown.",
    "",
    "Rules:",
    "- Re-insert structure: each `##`/`###` heading on its own line with a blank",
    "  line before and after; one blank line between paragraphs; each `-` list",
    "  item on its own line.",
    "- Remove any stray backslashes that escape Markdown punctuation (asterisks,",
    "  hashes, brackets, periods, hyphens, underscores) so the punctuation renders.",
    "- DO NOT add, remove, reword, translate, summarize, or reorder any prose.",
    "  Keep every sentence verbatim. Keep the original language (Brazilian",
    "  Portuguese).",
    "- Do not invent links, images, or headings that are not already present.",
    "- Output ONLY the repaired Markdown body — no code fences, no commentary.",
    "",
    "Corrupted body:",
    "<<<",
    body,
    ">>>",
  ].join("\n");

const wordBag = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replaceAll(/[\\*#[\]()`_>~-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

type RepairOutcome = {
  after?: string;
  method?: "html" | "llm";
  reason?: string;
  row: Row;
  status: "ok" | "skipped";
};

const repairOne = async (row: Row): Promise<RepairOutcome> => {
  const normalized = normalizeBody(row.body);
  if (normalized !== row.body) {
    if (normalized.trim().length === 0) {
      return { reason: "normalizeBody produced an empty body", row, status: "skipped" };
    }
    return { after: normalized, method: "html", row, status: "ok" };
  }

  const provider = requireProvider();
  const { text } = await generateText({
    model: provider(REPAIR_MODEL),
    prompt: buildPrompt(row.body),
  });
  const after = text.trim();

  if (after.includes(String.raw`\*`) || after.includes(String.raw`\#`)) {
    return { reason: "still contains escaped markdown", row, status: "skipped" };
  }
  if (!after.includes("\n")) {
    return { reason: "no line breaks restored", row, status: "skipped" };
  }
  if (after.length < row.body.length * 0.6 || after.length > row.body.length * 1.6) {
    return {
      reason: `length drift (${row.body.length} → ${after.length})`,
      row,
      status: "skipped",
    };
  }
  const inWords = wordBag(row.body);
  const outWords = wordBag(after);
  const missing = [...inWords].filter((w) => !outWords.has(w));
  const coverage = inWords.size === 0 ? 1 : 1 - missing.length / inWords.size;
  if (coverage < 0.92) {
    return { reason: `word coverage ${(coverage * 100).toFixed(0)}%`, row, status: "skipped" };
  }

  return { after, method: "llm", row, status: "ok" };
};

const newlineCount = (s: string): number => (s.match(/\n/g) ?? []).length;

const main = async (): Promise<number> => {
  const rows = await selectCorrupted();
  if (rows.length === 0) {
    console.log("No corrupted bodies found. Nothing to repair.");
    return 0;
  }

  const bySite = new Map<string, number>();
  for (const r of rows) {
    bySite.set(r.siteId, (bySite.get(r.siteId) ?? 0) + 1);
  }
  console.log(
    `Found ${rows.length} corrupted bodies across ${bySite.size} sites (${APPLY ? "APPLY" : "dry run"}).\n`,
  );

  const outcomes: Array<RepairOutcome> = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const settled = await Promise.all(
      batch.map(async (row): Promise<RepairOutcome> => {
        try {
          return await repairOne(row);
        } catch (error) {
          return { reason: String(error), row, status: "skipped" };
        }
      }),
    );
    outcomes.push(...settled);
    console.log(`  processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  const repaired = outcomes.filter((o) => o.status === "ok");
  const skipped = outcomes.filter((o) => o.status === "skipped");

  console.log(`\n=== results ===`);
  for (const o of repaired) {
    console.log(
      `  [ok:${o.method ?? "?"}] ${o.row.slug.padEnd(58)} nl ${newlineCount(o.row.body)} → ${newlineCount(o.after ?? "")}`,
    );
  }
  for (const o of skipped) {
    console.log(`  [skip]  ${o.row.slug.padEnd(60)} ${o.reason}`);
  }
  console.log(`\nrepaired=${repaired.length} skipped=${skipped.length}`);

  if (!APPLY) {
    const sample = repaired.at(0);
    if (sample !== undefined) {
      console.log(`\n--- sample preview: ${sample.row.slug} ---`);
      console.log(`BEFORE: ${JSON.stringify(sample.row.body.slice(0, 200))}`);
      console.log(`AFTER : ${JSON.stringify((sample.after ?? "").slice(0, 200))}`);
    }
    console.log("\nDry run — no writes. Re-run with --apply to persist.");
    return skipped.length > 0 ? 1 : 0;
  }

  const affectedSiteIds = new Set<string>();
  let written = 0;
  for (const o of repaired) {
    await prisma.post.update({ data: { body: o.after }, where: { id: o.row.id } });
    affectedSiteIds.add(o.row.siteId);
    written++;
  }

  recordAffectedSites([...affectedSiteIds]);
  console.log(
    `\nWrote ${written} bodies. ${affectedSiteIds.size} affected site ids → ${AFFECTED_SITES_FILE}`,
  );
  console.log("Next: `tsx tools/maintenance/redeploy-affected-sites.ts` to trigger rebuilds.");
  return skipped.length > 0 ? 1 : 0;
};

const cleanup = async (): Promise<void> => {
  await Promise.allSettled([prisma.$disconnect()]);
};

try {
  const code = await main();
  await cleanup();
  process.exit(code);
} catch (error) {
  console.error(error);
  await cleanup();
  process.exit(1);
}
