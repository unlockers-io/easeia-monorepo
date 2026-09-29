import { writeFileSync } from "node:fs";

import { requireProvider, REWRITE_MODEL as MODEL } from "@repo/ai";
import { type Niche, prisma } from "@repo/db";
import { generateText, Output } from "ai";
import { z } from "zod";

const CONCURRENCY = 6;
const MAX_BODY_CHARS = 2500;
const MAX_CANDIDATES = 30;

const EN_WORDS = new Set([
  "and",
  "architecture",
  "audio",
  "business",
  "commercial",
  "culture",
  "design",
  "digital",
  "editorials",
  "estate",
  "events",
  "fashion",
  "film",
  "food",
  "lifestyle",
  "marketing",
  "music",
  "photography",
  "podcast",
  "portrait",
  "real",
  "render",
  "tech",
  "travel",
  "videography",
]);

const hasPtDiacritics = (s: string): boolean => /[áàâãéêíóôõúçü]/iv.test(s);

const isEnglishCategory = (raw: string): boolean => {
  if (hasPtDiacritics(raw)) {
    return false;
  }
  const tokens = raw
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/gv, " ")
    .split(/\s+/v)
    .filter((t) => /[a-z]/v.test(t));
  if (tokens.length === 0) {
    return false;
  }
  return tokens.every((t) => EN_WORDS.has(t));
};

const isUsableCategory = (raw: string): boolean =>
  !raw.includes("&") && raw.trim().length >= 3 && raw.trim().length <= 40;

const stripHtml = (html: string): string =>
  html
    .replaceAll(/<!--[\s\S]*?-->/gv, "")
    .replaceAll(/<[^>]+>/gv, " ")
    .replaceAll(/\s+/gv, " ")
    .trim();

type Candidate = { count: number; name: string };

const singularKey = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/gv, "")
    .replaceAll(/[^a-z0-9\s]/gv, " ")
    .split(/\s+/v)
    .filter(Boolean)
    .map((w) => {
      if (w.endsWith("oes") || w.endsWith("aes")) {
        return `${w.slice(0, -3)}ao`;
      }
      return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
    })
    .join(" ");

const buildCandidates = (posts: ReadonlyArray<{ categories: Array<string> }>): Array<Candidate> => {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const c of p.categories) {
      if (isUsableCategory(c) && !isEnglishCategory(c)) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
  }
  const byKey = new Map<string, Candidate>();
  for (const [name, count] of [...counts.entries()].toSorted((a, b) => b[1] - a[1])) {
    const key = singularKey(name);
    const current = byKey.get(key);
    if (!current || count > current.count) {
      byKey.set(key, { count, name });
    }
  }
  return [...byKey.values()].toSorted((a, b) => b.count - a.count).slice(0, MAX_CANDIDATES);
};

const pickCategory = async (
  post: { body: string; niches: Array<Niche>; title: string },
  candidates: ReadonlyArray<Candidate>,
): Promise<string> => {
  const provider = requireProvider();
  const names = candidates.map((c) => c.name);
  const firstName = names.at(0);
  if (firstName === undefined) {
    throw new Error("Cannot classify a post without existing categories");
  }
  const schema = z.object({ category: z.enum([firstName, ...names.slice(1)]) });
  const list = candidates.map((c) => `- ${c.name} (${c.count} posts)`).join("\n");
  const prompt = [
    "Você classifica posts de blog em UMA categoria (seção) já existente do site.",
    "Escolha a categoria existente em português que melhor descreve o post.",
    "Responda apenas com uma das categorias da lista — não invente novas.",
    "",
    `Título: ${post.title}`,
    `Nichos: ${post.niches.join(", ") || "n/a"}`,
    `Trecho: ${stripHtml(post.body).slice(0, MAX_BODY_CHARS)}`,
    "",
    "Categorias existentes:",
    list,
  ].join("\n");

  const { output } = await generateText({
    model: provider(MODEL),
    output: Output.object({ schema }),
    prompt,
  });
  return output.category;
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY (writes to DB)" : "DRY-RUN"}\n`);

  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true },
  });

  const proposals: Array<{ category: string; domain: string; postId: string; title: string }> = [];
  const affectedSiteIds = new Set<string>();
  const failures: Array<{ domain: string; title: string }> = [];

  for (const site of sites) {
    const posts = await prisma.post.findMany({
      select: { body: true, categories: true, id: true, niches: true, title: true },
      where: { siteId: site.id },
    });
    const empties = posts.filter((p) => p.categories.length === 0);
    if (empties.length === 0) {
      continue;
    }
    const candidates = buildCandidates(posts);
    console.log(`=== ${site.domain}  (${empties.length} to fix)`);
    console.log(`    candidates: ${candidates.map((c) => c.name).join(", ")}\n`);

    for (let i = 0; i < empties.length; i += CONCURRENCY) {
      const chunk = empties.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((p) =>
          pickCategory({ body: p.body, niches: p.niches, title: p.title }, candidates),
        ),
      );
      for (const [j, res] of results.entries()) {
        const p = chunk.at(j);
        if (p === undefined) {
          continue;
        }
        if (res.status === "rejected") {
          failures.push({ domain: site.domain, title: p.title });
          console.log(`    [FAIL] ${p.title} :: ${String(res.reason).slice(0, 120)}`);
          continue;
        }
        proposals.push({
          category: res.value,
          domain: site.domain,
          postId: p.id,
          title: p.title,
        });
        affectedSiteIds.add(site.id);
        console.log(`    → ${res.value.padEnd(26)} | ${p.title}`);
      }
    }
    console.log("");
  }

  const byCat = new Map<string, number>();
  for (const pr of proposals) {
    byCat.set(pr.category, (byCat.get(pr.category) ?? 0) + 1);
  }
  console.log("=== Chosen categories ===");
  for (const [c, n] of [...byCat.entries()].toSorted((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${c}`);
  }
  console.log(`\nTotal proposals: ${proposals.length}  failures: ${failures.length}`);

  if (apply) {
    let updated = 0;
    for (const pr of proposals) {
      await prisma.post.update({
        data: { categories: [pr.category] },
        where: { id: pr.postId },
      });
      updated += 1;
    }
    writeFileSync(
      "/tmp/easeia-affected-site-ids.json",
      JSON.stringify([...affectedSiteIds], null, 2),
    );
    console.log(`\nAPPLIED: ${updated} posts updated.`);
    console.log(
      `Affected site ids written to /tmp/easeia-affected-site-ids.json (${affectedSiteIds.size} sites).`,
    );
  } else {
    console.log("\nDry-run only. Re-run with --apply to write.");
  }

  await prisma.$disconnect();
};

void main();
