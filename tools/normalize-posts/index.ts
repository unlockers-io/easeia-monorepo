/**
 * Dry-run by default. --apply stores every post whose text is not yet normalized through
 * Posts.reviseBody, which re-embeds, re-crawls and redeploys the live ones.
 */
import "dotenv/config";

import { prisma } from "@repo/db";
import { normalizePostText, reviseBody } from "@repo/posts";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 200;

const SELECT = {
  body: true,
  excerpt: true,
  focusKeyword: true,
  id: true,
  site: { select: { domain: true, language: true } },
  slug: true,
  title: true,
} as const;

const main = async (): Promise<void> => {
  const perSite = new Map<string, number>();
  const failures: Array<string> = [];
  let scanned = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.post.findMany({
      cursor: cursor === undefined ? undefined : { id: cursor },
      orderBy: { id: "asc" },
      select: SELECT,
      skip: cursor === undefined ? 0 : 1,
      take: BATCH_SIZE,
    });

    if (rows.length === 0) {
      break;
    }

    scanned += rows.length;
    cursor = rows.at(-1)?.id;

    for (const row of rows) {
      const text = {
        body: row.body,
        excerpt: row.excerpt,
        focusKeyword: row.focusKeyword,
        title: row.title,
      };

      const normalized = { ...text, ...normalizePostText(text, row.site.language) };

      if (JSON.stringify(normalized) === JSON.stringify(text)) {
        continue;
      }

      perSite.set(row.site.domain, (perSite.get(row.site.domain) ?? 0) + 1);

      if (!APPLY) {
        continue;
      }

      try {
        await reviseBody(row.id, { ...text, from: row.body });
      } catch (error) {
        failures.push(`${row.site.domain}/${row.slug}: ${String(error)}`);
      }
    }
  }

  const changed = [...perSite.values()].reduce((sum, n) => sum + n, 0);
  console.log(`scanned ${scanned} posts, ${changed} not normalized`);

  for (const [domain, n] of [...perSite].toSorted((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${domain.padEnd(30)} ${n}`);
  }

  if (!APPLY) {
    console.log("\ndry run: nothing written. Re-run with --apply to write.");

    return;
  }

  console.log(`\nwrote ${changed - failures.length} posts, ${failures.length} failed`);

  for (const failure of failures) {
    console.error(`  [FAIL] ${failure}`);
  }

  if (failures.length > 0) {
    process.exitCode = 1;
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
