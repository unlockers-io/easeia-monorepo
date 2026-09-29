/**
 * POSTs the Vercel deploy hook for each site any data tool has marked as
 * needing a rebuild, then clears the queue so the next run does not re-kick
 * sites that are already up to date.
 */
import "dotenv/config";

import { prisma } from "@repo/db";

import { clearAffectedSites, readAffectedSites } from "../_shared/affected-sites";

const main = async () => {
  const siteIds = readAffectedSites();
  if (siteIds.length === 0) {
    console.log("No sites pending redeploy.");
    return;
  }

  const sites = await prisma.site.findMany({
    select: { domain: true, id: true, vercelDeployHookUrl: true },
    where: { id: { in: siteIds } },
  });

  const results: Array<{ domain: string; error?: string; ok: boolean; status?: number }> = [];
  for (const site of sites) {
    if (site.vercelDeployHookUrl === null || site.vercelDeployHookUrl === "") {
      results.push({ domain: site.domain, error: "no deploy hook configured", ok: false });
      continue;
    }
    try {
      const res = await fetch(site.vercelDeployHookUrl, { method: "POST" });
      results.push({ domain: site.domain, ok: res.ok, status: res.status });
    } catch (error) {
      results.push({
        domain: site.domain,
        error: error instanceof Error ? error.message : String(error),
        ok: false,
      });
    }
  }

  console.log(`\n=== redeploy results ===`);
  for (const r of results) {
    const tag = r.ok ? "OK" : "FAIL";
    const detail = r.error ?? `HTTP ${r.status}`;
    console.log(`  [${tag}]  ${r.domain.padEnd(28)} ${detail}`);
  }
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} sites kicked.`);

  // Only when every hook fired: clearing after a partial run would drop the
  // sites that still need a rebuild.
  if (ok === results.length) {
    clearAffectedSites();
  } else {
    console.log("Queue kept: re-run after fixing the failures above.");
  }

  await prisma.$disconnect();
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
