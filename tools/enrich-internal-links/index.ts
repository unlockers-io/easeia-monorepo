/* Dry-run unless --apply; requires DATABASE_URL and OPENAI_API_KEY. */
import "dotenv/config";

import { requireProvider, REWRITE_MODEL as ENRICH_MODEL } from "@repo/ai";
import { prisma } from "@repo/db";
import { suggestForPost } from "@repo/suggest-links";
import { generateText } from "ai";

import { AFFECTED_SITES_FILE, recordAffectedSites } from "../_shared/affected-sites";

const BATCH_SIZE = 5;
const LINKS_PER_POST = 4;

const APPLY = process.argv.includes("--apply");
const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const numArg = (flag: string): number | undefined => {
  const value = argValue(flag);
  return value === undefined || value === "" ? undefined : Number(value);
};
const SITE = argValue("--site");
const LIMIT = numArg("--limit");
const OFFSET = numArg("--offset");
const SITE_SET = SITE !== undefined && SITE !== "";

type Anchor = { anchor: string; linkId: string; url: string };

const missingAnchors = (body: string, anchors: ReadonlyArray<Anchor>): Array<Anchor> =>
  anchors.filter((a) => !body.includes(a.url));

const proseOf = (s: string): string =>
  s
    .replace(/\n+## Leia também\n[\s\S]*$/u, "")
    .replaceAll(/\[(?<text>[^\]]+)\]\([^)]+\)/gu, "$<text>")
    .replaceAll(/\s+/gu, " ")
    .trim();

const selectPosts = (): Promise<
  Array<{ body: string; id: string; siteId: string; slug: string }>
> =>
  prisma.post.findMany({
    orderBy: { createdAt: "asc" },
    select: { body: true, id: true, siteId: true, slug: true },
    skip: OFFSET,
    take: LIMIT,
    where: {
      site: SITE_SET ? { domain: SITE } : undefined,
      status: "PUBLISHED",
    },
  });

const fetchTopSuggestions = async (postId: string, body: string): Promise<Array<Anchor>> => {
  const links = await prisma.link.findMany({
    orderBy: { suggestedAt: "desc" },
    select: { anchorText: true, id: true, toPostId: true, toUrl: true, type: true },
    where: { approved: null, fromPostId: postId, source: "SUGGESTED", toPostId: { not: null } },
  });
  const seen = new Set<string>();
  const out: Array<Anchor> = [];
  for (const l of links) {
    if (l.toPostId === null || seen.has(l.toPostId) || body.includes(l.toUrl)) {
      continue;
    }
    seen.add(l.toPostId);
    out.push({ anchor: l.anchorText, linkId: l.id, url: l.toUrl });
    if (out.length >= LINKS_PER_POST) {
      break;
    }
  }
  return out;
};

const buildPrompt = (body: string, anchors: ReadonlyArray<Anchor>): string =>
  [
    "You add internal links to a Brazilian-Portuguese blog post written in Markdown.",
    "",
    "For each target URL below, find an EXISTING phrase in the body that is",
    "topically relevant and wrap exactly that phrase as a Markdown link:",
    "`existing phrase` → `[existing phrase](url)`. Use the URL verbatim.",
    "",
    "HARD RULES:",
    "- Add ZERO new words. Do NOT write new sentences, intros, or 'veja também'",
    "  text. The ONLY characters you may add are the link syntax [ ] ( ) and the URL.",
    "- If no existing phrase is a good fit for a URL, SKIP that URL (leave it out).",
    "  Never force a link or invent text to host it.",
    "- Wrap each phrase at most once; never link inside a heading line.",
    "- Do not reword, remove, translate, reorder, or re-spell any other text.",
    "- Output ONLY the full Markdown body — no commentary, no code fences.",
    "",
    "Target URLs (suggested anchor shown for context only — link an existing phrase):",
    ...anchors.map((a) => `- ${a.url}  (about: ${a.anchor})`),
    "",
    "Body:",
    "<<<",
    body,
    ">>>",
  ].join("\n");

const leiaTambemBlock = (anchors: ReadonlyArray<Anchor>): string =>
  ["", "", "## Leia também", "", ...anchors.map((a) => `- [${a.anchor}](${a.url})`)].join("\n");

type Outcome = {
  after?: string;
  id: string;
  linkIds?: Array<string>;
  method?: "fallback" | "inline";
  reason?: string;
  siteId: string;
  slug: string;
  status: "enriched" | "skipped";
};

const enrichOne = async (post: {
  body: string;
  id: string;
  siteId: string;
  slug: string;
}): Promise<Outcome> => {
  await suggestForPost(post.id);
  const anchors = await fetchTopSuggestions(post.id, post.body);
  if (anchors.length === 0) {
    return {
      id: post.id,
      reason: "no fresh suggestions",
      siteId: post.siteId,
      slug: post.slug,
      status: "skipped",
    };
  }

  const provider = requireProvider();
  const { text } = await generateText({
    model: provider(ENRICH_MODEL),
    prompt: buildPrompt(post.body, anchors),
  });
  const llm = text.trim();

  const llmClean = proseOf(llm) === proseOf(post.body);

  let after = llmClean ? llm : post.body;
  const method: "fallback" | "inline" = llmClean ? "inline" : "fallback";

  const missing = missingAnchors(after, anchors);
  if (missing.length > 0) {
    after += leiaTambemBlock(missing);
  }

  return {
    after,
    id: post.id,
    linkIds: anchors.map((a) => a.linkId),
    method,
    siteId: post.siteId,
    slug: post.slug,
    status: "enriched",
  };
};

const main = async (): Promise<number> => {
  const posts = await selectPosts();
  console.log(
    `Enriching ${posts.length} published posts${SITE_SET ? ` on ${SITE}` : " network-wide"} (${APPLY ? "APPLY" : "dry run"}).\n`,
  );

  const outcomes: Array<Outcome> = [];
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const settled = await Promise.all(
      batch.map(async (p): Promise<Outcome> => {
        try {
          return await enrichOne(p);
        } catch (error) {
          return {
            id: p.id,
            reason: String(error),
            siteId: p.siteId,
            slug: p.slug,
            status: "skipped",
          };
        }
      }),
    );
    outcomes.push(...settled);
    console.log(`  processed ${Math.min(i + BATCH_SIZE, posts.length)}/${posts.length}`);
  }

  const enriched = outcomes.filter((o) => o.status === "enriched");
  const inline = enriched.filter((o) => o.method === "inline").length;
  const fallback = enriched.filter((o) => o.method === "fallback").length;
  const linksAdded = enriched.reduce((n, o) => n + (o.linkIds?.length ?? 0), 0);
  console.log(
    `\nenriched=${enriched.length} (inline=${inline} fallback=${fallback}) linksAdded=${linksAdded} skipped=${outcomes.length - enriched.length}`,
  );

  const skipReasons = new Map<string, number>();
  for (const o of outcomes.filter((x) => x.status === "skipped")) {
    const key = (o.reason ?? "unknown").slice(0, 80);
    skipReasons.set(key, (skipReasons.get(key) ?? 0) + 1);
  }
  for (const [reason, n] of skipReasons) {
    console.log(`  skip (${n}): ${reason}`);
  }

  if (!APPLY) {
    const sample = enriched.find((o) => o.method === "inline") ?? enriched.at(0);
    if (sample) {
      console.log(`\n--- sample (${sample.method}): ${sample.slug} ---`);
      console.log((sample.after ?? "").slice(-500));
    }
    console.log("\nDry run — no writes. Re-run with --apply to persist.");
    return 0;
  }

  const affected = new Set<string>();
  for (const o of enriched) {
    await prisma.$transaction([
      prisma.post.update({ data: { body: o.after }, where: { id: o.id } }),
      prisma.link.updateMany({ data: { approved: true }, where: { id: { in: o.linkIds ?? [] } } }),
    ]);
    affected.add(o.siteId);
  }

  recordAffectedSites([...affected]);
  console.log(
    `\nWrote ${enriched.length} bodies. ${affected.size} affected site ids → ${AFFECTED_SITES_FILE}`,
  );
  console.log("Next: `tsx tools/maintenance/redeploy-affected-sites.ts` to trigger rebuilds.");
  return 0;
};

try {
  const code = await main();
  await prisma.$disconnect();
  process.exit(code);
} catch (error) {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
