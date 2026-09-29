/**
 * Dry-run by default. --apply renames English categories to Portuguese only where
 * the site's categorySlugMap maps both names to one slug; anything that would move
 * an indexed category page is skipped. Redeploy with redeploy-affected-sites after.
 */
import "dotenv/config";

import { prisma } from "@repo/db";

import { recordAffectedSites } from "../_shared/affected-sites";
import { slugify } from "../_shared/slugify";

const APPLY = process.argv.includes("--apply");

const RENAMES: Readonly<Partial<Record<string, string>>> = {
  Architecture: "Arquitetura",
  Audio: "Áudio",
  Business: "Negócios",
  Commercial: "Comercial",
  Culture: "Cultura",
  Events: "Eventos",
  Fashion: "Moda",
  Film: "Filmes",
  Food: "Gastronomia",
  Lifestyle: "Estilo de Vida",
  Photography: "Fotografia",
  Portrait: "Retrato",
  "Real Estate": "Imóveis",
  Tech: "Tecnologia",
  Travel: "Viagem",
  Videography: "Videografia",
  Wedding: "Casamento",
};

type SiteRow = { categorySlugMap: unknown; domain: string; id: string };

const slugFor = (map: Record<string, string>, name: string): string => map[name] ?? slugify(name);

const tally = (label: string, rows: Map<string, number>): void => {
  const total = [...rows.values()].reduce((sum, n) => sum + n, 0);
  console.log(`\n${label}: ${total} category assignments across ${rows.size} pairs`);
  for (const [key, count] of [...rows.entries()].toSorted((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${key}`);
  }
};

const main = async (): Promise<void> => {
  const sites: Array<SiteRow> = await prisma.site.findMany({
    select: { categorySlugMap: true, domain: true, id: true },
  });
  const posts = await prisma.post.findMany({
    select: { categories: true, id: true, siteId: true },
  });
  const siteById = new Map(sites.map((site) => [site.id, site]));

  const planned: Array<{ id: string; next: Array<string>; siteId: string }> = [];
  const applied = new Map<string, number>();
  const skipped = new Map<string, number>();

  for (const post of posts) {
    const site = siteById.get(post.siteId);
    if (!site) {
      continue;
    }
    const map = (site.categorySlugMap ?? {}) as Record<string, string>;
    const next: Array<string> = [];
    let changed = false;

    for (const category of post.categories) {
      const target = RENAMES[category];
      if (target === undefined) {
        next.push(category);
        continue;
      }
      const key = `${site.domain} ${category} -> ${target}`;
      if (slugFor(map, category) !== slugFor(map, target)) {
        skipped.set(key, (skipped.get(key) ?? 0) + 1);
        next.push(category);
        continue;
      }
      applied.set(key, (applied.get(key) ?? 0) + 1);
      next.push(target);
      changed = true;
    }

    if (changed) {
      planned.push({ id: post.id, next: [...new Set(next)], siteId: post.siteId });
    }
  }

  tally("RENAME (url unchanged)", applied);
  tally("SKIPPED (would move an indexed url)", skipped);
  console.log(`\nposts to update: ${planned.length}`);

  if (!APPLY) {
    console.log("\ndry run; pass --apply to write");
    return;
  }

  for (const post of planned) {
    await prisma.post.update({ data: { categories: post.next }, where: { id: post.id } });
  }
  const touched = recordAffectedSites([...new Set(planned.map((p) => p.siteId))]);
  console.log(`\nupdated ${planned.length} posts; ${touched.length} sites pending redeploy`);
};

await main();
await prisma.$disconnect();
