import { analyzeBody, splitBlocks, type DedupeResult } from "@repo/posts";

import type { Repair, Row } from "./report";

const isTailOfOriginal = (before: string, after: string): boolean => {
  const originalBlocks = splitBlocks(before);
  const repairedBlocks = splitBlocks(after);
  if (repairedBlocks.length === 0 || repairedBlocks.length > originalBlocks.length) {
    return false;
  }
  const tail = originalBlocks.slice(-repairedBlocks.length);
  return tail.every((block, i) => block === repairedBlocks[i]);
};

/** The buckets `printReport` consumes, while they are still being filled. `ReportInput` says what each one means. */
export type Classified = {
  acceptedSuperseded: Array<Repair>;
  nearMisses: Array<Row>;
  needsReview: Array<Repair>;
  rejected: Array<Repair>;
  writable: Array<Repair>;
};

export type ClassifyOptions = {
  /** Lets a `would-drop` row be written. Never relaxes the tail proof. */
  acceptSuperseded: boolean;
  /**
   * The repair under proof. Injected rather than imported so a test can hand
   * `classify` a candidate the real `dedupeBody` cannot currently produce, which
   * is the only way to show the tail proof still refuses one.
   */
  dedupe: (body: string) => DedupeResult;
};

/**
 * Files each row into `into`, and returns the repairs this call put on the write
 * path, both proofs together, in row order. The caller writes that batch; the
 * buckets on `into` are what keep the two proofs distinguishable afterwards.
 */
export const classify = (
  rows: ReadonlyArray<Row>,
  into: Classified,
  options: ClassifyOptions,
): Array<Repair> => {
  const written: Array<Repair> = [];

  for (const row of rows) {
    if (!analyzeBody(row.body).isCorrupt) {
      into.nearMisses.push(row);
      continue;
    }
    const result = options.dedupe(row.body);
    const repair: Repair = {
      after: result.candidate,
      analysis: result.analysis,
      before: row.body,
      candidate: result.candidate,
      dropped: result.dropped,
      method: result.method,
      postId: row.id,
      removedBlocks: result.removedBlocks,
      site: row.site.domain,
      siteId: row.siteId,
      slug: row.slug,
      status: row.status,
    };

    if (result.method === "would-drop") {
      if (!options.acceptSuperseded) {
        into.needsReview.push(repair);
        continue;
      }
      if (!isTailOfOriginal(row.body, repair.after)) {
        into.rejected.push(repair);
        continue;
      }
      into.acceptedSuperseded.push(repair);
      written.push(repair);
      continue;
    }

    if (!result.changed) {
      continue;
    }
    if (!isTailOfOriginal(row.body, repair.after)) {
      into.rejected.push(repair);
      continue;
    }
    into.writable.push(repair);
    written.push(repair);
  }

  return written;
};
