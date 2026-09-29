import { STRIP_RULES, type StripRule } from "@repo/posts";

export const FIELDS = ["title", "excerpt", "body", "focusKeyword"] as const;

export type Field = (typeof FIELDS)[number];

export type Change = {
  after: string;
  before: string;
  counts: Record<StripRule, number>;
  field: Field;
  postId: string;
  site: string;
  slug: string;
  status: string;
};

const addCounts = (
  into: Partial<Record<StripRule, number>>,
  from: Record<StripRule, number>,
): void => {
  for (const rule of STRIP_RULES) {
    if (from[rule] > 0) {
      into[rule] = (into[rule] ?? 0) + from[rule];
    }
  }
};

const SAMPLE_RADIUS = 90;

/** The window around the first rewritten span, so samples stay readable. */
const excerptAround = (before: string, after: string): { after: string; before: string } => {
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) {
    i += 1;
  }
  const from = Math.max(0, i - SAMPLE_RADIUS);
  const clip = (s: string): string =>
    (from > 0 ? "..." : "") +
    s.slice(from, i + SAMPLE_RADIUS) +
    (s.length > i + SAMPLE_RADIUS ? "..." : "");
  return { after: clip(after), before: clip(before) };
};

const SAMPLES_PER_RULE = 4;

export type Coverage = {
  /** Posts whose body was actually read. Below `scanned` when bodies are sampled. */
  bodiesRead: number;
  scanned: number;
};

export const printReport = (changes: Array<Change>, coverage: Coverage): void => {
  const { bodiesRead, scanned } = coverage;
  const perSite = new Map<string, Partial<Record<Field, number>>>();
  const perField: Partial<Record<Field, number>> = {};
  const perRule: Partial<Record<StripRule, number>> = {};
  const perStatus: Record<string, number> = {};
  const posts = new Set<string>();
  const samples = new Map<StripRule, Array<Change>>();

  for (const c of changes) {
    posts.add(c.postId);
    const site = perSite.get(c.site) ?? {};
    site[c.field] = (site[c.field] ?? 0) + 1;
    perSite.set(c.site, site);
    perField[c.field] = (perField[c.field] ?? 0) + 1;
    perStatus[c.status] = (perStatus[c.status] ?? 0) + 1;
    addCounts(perRule, c.counts);
    for (const rule of STRIP_RULES) {
      if (c.counts[rule] === 0) {
        continue;
      }
      const bucket = samples.get(rule) ?? [];
      if (bucket.length < SAMPLES_PER_RULE) {
        bucket.push(c);
        samples.set(rule, bucket);
      }
    }
  }

  console.log(`\nscanned ${scanned} posts, ${posts.size} affected, ${changes.length} field values`);
  if (bodiesRead < scanned) {
    const pct = ((bodiesRead / scanned) * 100).toFixed(0);
    console.log(
      `\n!! BODY SAMPLE, NOT A CENSUS: ${bodiesRead} of ${scanned} bodies read (${pct}%).`,
    );
    console.log(`!! Body counts below are from that sample. Do not quote them as a fleet total.`);
    const projected = Math.round(((perField.body ?? 0) / bodiesRead) * scanned);
    console.log(`!! Titles and excerpts ARE a census. Bodies extrapolate to about ${projected}.`);
  }
  console.log("");

  console.log("per site");
  for (const [site, fields] of [...perSite].toSorted((a, b) => a[0].localeCompare(b[0]))) {
    const parts = FIELDS.flatMap((field) =>
      (fields[field] ?? 0) > 0 ? [`${field} ${fields[field]}`] : [],
    );
    console.log(`  ${site.padEnd(30)} ${parts.join("  ")}`);
  }

  console.log("\nper field");
  for (const f of FIELDS) {
    if ((perField[f] ?? 0) > 0) {
      console.log(`  ${f.padEnd(14)} ${perField[f]}`);
    }
  }

  console.log("\nper status");
  for (const [s, n] of Object.entries(perStatus).toSorted((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(14)} ${n}`);
  }

  const ruleTotal = STRIP_RULES.reduce((a, rule) => a + (perRule[rule] ?? 0), 0);
  console.log(`\nper rule (${ruleTotal} occurrences)`);
  const ranked = STRIP_RULES.filter((rule) => (perRule[rule] ?? 0) > 0).toSorted(
    (a, b) => (perRule[b] ?? 0) - (perRule[a] ?? 0),
  );
  for (const rule of ranked) {
    const n = perRule[rule] ?? 0;
    console.log(
      `  ${rule.padEnd(20)} ${String(n).padStart(6)}  ${((n / ruleTotal) * 100).toFixed(1)}%`,
    );
  }

  for (const [rule, bucket] of samples) {
    console.log(`\n--- ${rule} ---`);
    for (const c of bucket) {
      const { after, before } = excerptAround(c.before, c.after);
      console.log(`  ${c.site}/${c.slug} [${c.field}]`);
      console.log(`    before  ${before}`);
      console.log(`    after   ${after}`);
    }
  }
};
