/**
 * Dry-run by default. --apply collapses tag names differing only in case, accent
 * or a leading hash onto one stored name. They share a slug, so every /tag/ URL
 * survives; the tool refuses a canonical name that disagrees. Redeploy after.
 */
import "dotenv/config";

import { prisma } from "@repo/db";

import { recordAffectedSites } from "../_shared/affected-sites";
import { slugify } from "../_shared/slugify";

const APPLY = process.argv.includes("--apply");

const groupKey = (siteId: string, tag: string): string => `${siteId}::${slugify(tag)}`;

const countMatches = (value: string, pattern: RegExp): number =>
  (value.match(pattern) ?? []).length;

const accents = (value: string): number =>
  countMatches(value.normalize("NFD"), /[\u0300-\u036f]/gu);

/**
 * Ranked by accents, capitals, a leading hash, frequency, then name. The hash
 * outranks frequency because the fleet styles tags as hashtags.
 */
const canonical = (variants: Map<string, number>): string => {
  const [top] = [...variants.entries()].toSorted(
    (a, b) =>
      accents(b[0]) - accents(a[0]) ||
      countMatches(b[0], /\p{Lu}/gu) - countMatches(a[0], /\p{Lu}/gu) ||
      Number(b[0].startsWith("#")) - Number(a[0].startsWith("#")) ||
      b[1] - a[1] ||
      a[0].localeCompare(b[0]),
  );
  if (top === undefined) {
    throw new Error("canonical: variants must not be empty");
  }
  return top[0];
};

const main = async (): Promise<void> => {
  const posts = await prisma.post.findMany({ select: { id: true, siteId: true, tags: true } });

  const variantsByGroup = new Map<string, Map<string, number>>();
  for (const post of posts) {
    for (const tag of post.tags) {
      const key = groupKey(post.siteId, tag);
      const variants = variantsByGroup.get(key) ?? new Map<string, number>();
      variants.set(tag, (variants.get(tag) ?? 0) + 1);
      variantsByGroup.set(key, variants);
    }
  }

  const winner = new Map<string, string>();
  for (const [key, variants] of variantsByGroup) {
    if (variants.size > 1) {
      const name = canonical(variants);
      const [siteId = ""] = key.split("::");
      if (key !== groupKey(siteId, name)) {
        throw new Error(`refusing "${name}": it would move ${key}`);
      }
      winner.set(key, name);
    }
  }

  let chipsRemoved = 0;
  const planned: Array<{ id: string; next: Array<string>; siteId: string }> = [];
  for (const post of posts) {
    const mapped = post.tags.map((tag) => winner.get(groupKey(post.siteId, tag)) ?? tag);
    const next = [...new Set(mapped)];
    if (next.length !== post.tags.length || next.some((tag, index) => tag !== post.tags[index])) {
      chipsRemoved += post.tags.length - next.length;
      planned.push({ id: post.id, next, siteId: post.siteId });
    }
  }

  console.log(`tag groups collapsed: ${winner.size}`);
  console.log(`posts to update: ${planned.length}`);
  console.log(`duplicate chips removed: ${chipsRemoved}`);

  if (!APPLY) {
    const widest = [...winner.entries()].toSorted(
      (a, b) => (variantsByGroup.get(b[0])?.size ?? 0) - (variantsByGroup.get(a[0])?.size ?? 0),
    );
    for (const [key, name] of widest.slice(0, 12)) {
      const variants = [...(variantsByGroup.get(key)?.keys() ?? [])];
      console.log(`  /tag/${key.split("::")[1]}/ keeps "${name}"  from ${variants.join(" | ")}`);
    }
    console.log("\ndry run; pass --apply to write");
    return;
  }

  for (const post of planned) {
    await prisma.post.update({ data: { tags: post.next }, where: { id: post.id } });
  }
  const touched = recordAffectedSites([...new Set(planned.map((post) => post.siteId))]);
  console.log(`\nupdated ${planned.length} posts; ${touched.length} sites pending redeploy`);
};

await main();
await prisma.$disconnect();
