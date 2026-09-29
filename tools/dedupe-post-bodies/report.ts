import type { BodyAnalysis, DedupeMethod, DroppedBlock } from "@repo/posts";

export type Row = {
  body: string;
  id: string;
  site: { domain: string };
  siteId: string;
  slug: string;
  status: string;
};

export type Repair = {
  after: string;
  analysis: BodyAnalysis;
  before: string;
  candidate: string;
  dropped: Array<DroppedBlock>;
  method: DedupeMethod;
  postId: string;
  removedBlocks: number;
  site: string;
  siteId: string;
  slug: string;
  status: string;
};

export type ReportInput = {
  /**
   * `would-drop` rows written only because `--accept-superseded` was passed: the
   * weaker path. Held apart from `writable` so nobody later reads one of these as
   * having passed the strict proof.
   */
  acceptedSuperseded: ReadonlyArray<Repair>;
  /** Probe hits the detector cleared: fewer duplicated substantial blocks than the threshold. */
  nearMisses: ReadonlyArray<Row>;
  /** Corrupt, and a superseded version holds prose the final one does not. Written only under `--accept-superseded`. */
  needsReview: ReadonlyArray<Repair>;
  /** Repairs refused because the result was not the tail of the original. */
  rejected: ReadonlyArray<Repair>;
  /** Proven safe to write: `exact` or `superset`. */
  writable: ReadonlyArray<Repair>;
};

const kb = (n: number): string => `${(n / 1024).toFixed(1)}KB`;

const SAMPLE_CHARS = 160;
const QUOTE_CHARS = 220;
const MAX_QUOTED_PER_POST = 6;

/** Bytes the repair reclaims. The report ranks on this so the worst row leads. */
const recovered = (r: Repair): number => r.before.length - r.candidate.length;

const byRecovered = (a: Repair, b: Repair): number => recovered(b) - recovered(a);

const line = (r: Repair): string =>
  `  ${String(r.analysis.maxRepeat).padStart(5)}x  ${kb(r.before.length).padStart(9)} -> ` +
  `${kb(r.candidate.length).padStart(8)}  blocks ${String(r.analysis.blocks).padStart(6)} -> ` +
  `${String(r.analysis.blocks - r.removedBlocks).padStart(3)}  ` +
  `${r.status.padEnd(9)} ${r.site}/${r.slug}`;

const verdict = (r: Repair): "possible-content-loss" | "superseded-draft" =>
  r.dropped.every((d) => d.superseded) ? "superseded-draft" : "possible-content-loss";

const quote = (s: string): string =>
  JSON.stringify(s.length > QUOTE_CHARS ? `${s.slice(0, QUOTE_CHARS)}...` : s);

const printEvidence = (r: Repair): void => {
  const orphans = r.dropped.filter((d) => !d.superseded);
  console.log(`\n  ${r.site}/${r.slug}  [${verdict(r)}]`);
  console.log(
    `    ${kb(r.before.length)} -> ${kb(r.candidate.length)} (${kb(recovered(r))} recoverable), ` +
      `${r.analysis.maxRepeat} copies, ${r.dropped.length} block(s) dropped, ` +
      `${orphans.length} with no surviving counterpart`,
  );
  const ordered = [...orphans, ...r.dropped.filter((d) => d.superseded)];
  for (const d of ordered.slice(0, MAX_QUOTED_PER_POST)) {
    const tag = d.superseded ? "rewritten" : "NO COUNTERPART";
    console.log(`    [${tag} sim ${d.similarity.toFixed(2)}] ${quote(d.block)}`);
    console.log(`      closest survivor: ${d.closest === undefined ? "(none)" : quote(d.closest)}`);
  }
  const hidden = ordered.length - MAX_QUOTED_PER_POST;
  if (hidden > 0) {
    console.log(`    ... and ${hidden} more`);
  }
};

export const printReport = ({
  acceptedSuperseded,
  nearMisses,
  needsReview,
  rejected,
  writable,
}: ReportInput): void => {
  const exact = writable.filter((r) => r.method === "exact");
  const superset = writable.filter((r) => r.method === "superset");

  console.log(
    `\n${writable.length} repairable (${exact.length} exact, ${superset.length} superset), ` +
      `${acceptedSuperseded.length} accepted-superseded, ` +
      `${needsReview.length} need review, ${nearMisses.length} near misses`,
  );

  if (writable.length > 0) {
    const perSite = new Map<string, number>();
    for (const r of writable) {
      perSite.set(r.site, (perSite.get(r.site) ?? 0) + 1);
    }
    console.log("\nper site");
    for (const [site, n] of [...perSite].toSorted((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${site.padEnd(30)} ${n}`);
    }

    if (exact.length > 0) {
      console.log(
        "\nEXACT: nested version chain, and the final version holds every distinct block.",
      );
      for (const r of [...exact].toSorted(byRecovered)) {
        console.log(line(r));
      }
    }

    if (superset.length > 0) {
      console.log("\nSUPERSET: the weaker proof, and deliberately not the strict one. The version");
      console.log("chain is not nested, because an edit inside a later version breaks the suffix");
      console.log("relation, but the final version still holds every distinct block, so taking it");
      console.log("drops no prose.");
      for (const r of [...superset].toSorted(byRecovered)) {
        console.log(line(r));
      }
    }

    const before = writable.reduce((a, r) => a + r.before.length, 0);
    const after = writable.reduce((a, r) => a + r.after.length, 0);
    console.log(`\ntotal ${kb(before)} -> ${kb(after)}`);

    const worst = [...writable].toSorted(byRecovered).at(0);
    if (worst !== undefined) {
      console.log(`\n--- sample: ${worst.site}/${worst.slug} ---`);
      console.log(
        `BEFORE (${kb(worst.before.length)}): ${JSON.stringify(worst.before.slice(0, SAMPLE_CHARS))}`,
      );
      console.log(
        `AFTER  (${kb(worst.after.length)}): ${JSON.stringify(worst.after.slice(0, SAMPLE_CHARS))}`,
      );
    }
  }

  if (acceptedSuperseded.length > 0) {
    const ranked = [...acceptedSuperseded].toSorted(byRecovered);
    const loss = ranked.filter((r) => verdict(r) === "possible-content-loss");
    const total = ranked.reduce((a, r) => a + recovered(r), 0);
    console.log(
      `\nACCEPTED SUPERSEDED: ${ranked.length} rows, ${kb(total)} recoverable, admitted by` +
        ` --accept-superseded\nWITHOUT either proof that the final version holds every distinct` +
        ` block. On --apply the prose\nquoted below leaves the body and survives only in the backup` +
        ` file, whose lines carry\n"acceptedSuperseded": true. ${loss.length} have at least one` +
        ` block with no surviving counterpart.`,
    );
    for (const r of ranked) {
      printEvidence(r);
    }
  }

  if (needsReview.length > 0) {
    const ranked = [...needsReview].toSorted(byRecovered);
    const loss = ranked.filter((r) => verdict(r) === "possible-content-loss");
    const total = ranked.reduce((a, r) => a + recovered(r), 0);
    console.log(
      `\nNEEDS REVIEW: ${ranked.length} rows, ${kb(total)} recoverable, held back because a` +
        ` superseded\nversion holds prose the final one does not. ${loss.length} have at least one` +
        ` block with no\nsurviving counterpart; the rest look like drafts a rewrite replaced.` +
        `\nRe-run with --accept-superseded to write them anyway; they still have to be a tail of` +
        `\nthe original, and they are reported and backed up apart from the proven rows.`,
    );
    for (const r of ranked) {
      printEvidence(r);
    }
  }

  if (rejected.length > 0) {
    console.log("\nREFUSED: repaired body was not the tail of the original. Not written.");
    console.log("--accept-superseded does not relax this proof: rows it admits land here too.");
    for (const r of rejected) {
      console.log(`  ${r.site}/${r.slug}`);
    }
  }

  if (nearMisses.length > 0) {
    console.log("\nnear misses: duplicated substantial blocks below the repair threshold.");
    console.log("Left untouched by design; review by hand if a post here looks wrong.");
    for (const row of nearMisses) {
      console.log(`  ${row.site.domain}/${row.slug}`);
    }
  }

  console.log(
    "\nCounts above describe the database. A census taken from the rendered blogs" +
      "\npartitions the same rows differently, so do not carry one over to the other.",
  );
};
