/* Dry-run unless --apply. */
import "dotenv/config";

import { generateStructured } from "@repo/ai";
import { prisma } from "@repo/db";
import { closeJobs } from "@repo/jobs";
import { approveSuggestions, listSuggestions, suggestForPost } from "@repo/links";
import { reviseBody } from "@repo/posts";
import { z } from "zod";

const BATCH_SIZE = 5;
const LINKS_PER_POST = 4;
const SUGGESTIONS_PER_POST = 20;

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

const bodySchema = z.object({ body: z.string() });

const proseOf = (s: string): string =>
  s
    .replace(/\n+## Leia também\n[\s\S]*$/u, "")
    .replaceAll(/\[(?<text>[^\]]+)\]\([^)]+\)/gu, "$<text>")
    .replaceAll(/\s+/gu, " ")
    .trim();

const selectPosts = (): Promise<Array<{ body: string; id: string; slug: string }>> =>
  prisma.post.findMany({
    orderBy: { createdAt: "asc" },
    select: { body: true, id: true, slug: true },
    skip: OFFSET,
    take: LIMIT,
    where: {
      site: SITE_SET ? { domain: SITE } : undefined,
      status: "PUBLISHED",
    },
  });

const fetchTopSuggestions = async (postId: string, body: string): Promise<Array<Anchor>> => {
  const links = await listSuggestions({ fromPostId: postId, limit: SUGGESTIONS_PER_POST });
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
    "- Return the full Markdown body as `body`, with no commentary and no code fences.",
    "",
    "Target URLs (suggested anchor shown for context only — link an existing phrase):",
    ...anchors.map((a) => `- ${a.url}  (about: ${a.anchor})`),
    "",
    "Body:",
    "<<<",
    body,
    ">>>",
  ].join("\n");

type Outcome = {
  after?: string;
  before?: string;
  id: string;
  linkIds?: Array<string>;
  method?: "fallback" | "inline";
  reason?: string;
  slug: string;
  status: "enriched" | "skipped";
};

const enrichOne = async (post: { body: string; id: string; slug: string }): Promise<Outcome> => {
  await suggestForPost(post.id);
  const anchors = await fetchTopSuggestions(post.id, post.body);
  if (anchors.length === 0) {
    return {
      id: post.id,
      reason: "no fresh suggestions",
      slug: post.slug,
      status: "skipped",
    };
  }

  const { body } = await generateStructured({
    prompt: buildPrompt(post.body, anchors),
    schema: bodySchema,
  });
  const llm = body.trim();

  const llmClean = proseOf(llm) === proseOf(post.body);

  return {
    after: llmClean ? llm : post.body,
    before: post.body,
    id: post.id,
    linkIds: anchors.map((a) => a.linkId),
    method: llmClean ? "inline" : "fallback",
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

  for (const o of enriched) {
    if (o.before !== undefined && o.after !== undefined && o.after !== o.before) {
      await reviseBody(o.id, { body: o.after, from: o.before });
    }
    await approveSuggestions(o.id, o.linkIds ?? []);
  }

  console.log(`\nWrote ${enriched.length} bodies.`);
  return 0;
};

const cleanup = async (): Promise<void> => {
  await Promise.allSettled([prisma.$disconnect(), closeJobs()]);
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
