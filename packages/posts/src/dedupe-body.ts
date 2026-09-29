const MIN_SUBSTANTIAL_CHARS = 80;

const CORRUPTION_THRESHOLD = 2;

const FENCE_RE = /^\s*(?:```|~~~)/v;

/**
 * Markdown paragraph units. Fenced code survives as one block: a fence
 * containing a blank line would otherwise split into pieces that then look
 * like independent repeats.
 */
export const splitBlocks = (body: string): Array<string> => {
  const blocks: Array<string> = [];
  let buffer: Array<string> = [];
  let inFence = false;

  const flush = (): void => {
    const text = buffer.join("\n").trim();
    if (text !== "") {
      blocks.push(text);
    }
    buffer = [];
  };

  for (const line of body.split("\n")) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      buffer.push(line);
      continue;
    }
    if (!inFence && line.trim() === "") {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
};

export type BodyAnalysis = {
  /** Total paragraph units. */
  blocks: number;
  /** Substantial blocks beyond the first occurrence of each. The decision metric. */
  duplicatedSubstantial: number;
  isCorrupt: boolean;
  /** Highest occurrence count of any single block. Reporting only. */
  maxRepeat: number;
};

const countMaxRepeat = (blocks: ReadonlyArray<string>): number => {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }
  let max = 0;
  for (const n of counts.values()) {
    max = Math.max(max, n);
  }
  return max;
};

export const analyzeBody = (body: string): BodyAnalysis => {
  const blocks = splitBlocks(body);
  const substantial = blocks.filter((b) => b.length >= MIN_SUBSTANTIAL_CHARS);
  const duplicatedSubstantial = substantial.length - new Set(substantial).size;
  return {
    blocks: blocks.length,
    duplicatedSubstantial,
    isCorrupt: duplicatedSubstantial >= CORRUPTION_THRESHOLD,
    maxRepeat: countMaxRepeat(blocks),
  };
};

const splitIntoVersions = (blocks: ReadonlyArray<string>): Array<Array<string>> | undefined => {
  const closing = blocks.at(-1);
  if (closing === undefined) {
    return undefined;
  }

  const boundaries: Array<number> = [];
  for (const [i, block] of blocks.entries()) {
    if (block === closing) {
      boundaries.push(i);
    }
  }
  if (boundaries.length < 2) {
    return undefined;
  }

  const segments: Array<Array<string>> = [];
  let start = 0;
  for (const boundary of boundaries) {
    segments.push(blocks.slice(start, boundary + 1));
    start = boundary + 1;
  }
  return segments;
};

/**
 * The strict proof: every superseded version is a suffix of the final one, so
 * the body grew only by prepending and the versions form a clean nested chain.
 */
const isNestedChain = (segments: ReadonlyArray<ReadonlyArray<string>>): boolean => {
  const final = segments.at(-1);
  if (final === undefined) {
    return false;
  }
  return segments
    .slice(0, -1)
    .every(
      (segment) =>
        segment.length <= final.length &&
        segment.every((block, i) => block === final[final.length - segment.length + i]),
    );
};

const WORD_RE = /[^\p{L}\p{N}]+/v;

const contentWords = (block: string): Set<string> =>
  new Set(
    block
      .toLowerCase()
      .split(WORD_RE)
      .filter((w) => w.length > 3),
  );

const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) {
      shared += 1;
    }
  }
  return shared / (a.size + b.size - shared);
};

const SUPERSEDED_SIMILARITY = 0.3;

export type DroppedBlock = {
  block: string;
  /** Closest surviving block, whatever the score, so a below-threshold match stays visible. */
  closest: string | undefined;
  similarity: number;
  /** The closest survivor reads as a rewrite of this block. Advisory, never a gate. */
  superseded: boolean;
};

const describeDropped = (
  dropped: ReadonlyArray<string>,
  kept: ReadonlyArray<string>,
): Array<DroppedBlock> => {
  const keptWords = kept.map((block) => ({ block, words: contentWords(block) }));
  return dropped.map((block) => {
    const words = contentWords(block);
    let best: { block: string; score: number } | undefined;
    for (const candidate of keptWords) {
      const score = jaccard(words, candidate.words);
      if (best === undefined || score > best.score) {
        best = { block: candidate.block, score };
      }
    }
    const score = best?.score ?? 0;
    return {
      block,
      closest: best?.block,
      similarity: score,
      superseded: score >= SUPERSEDED_SIMILARITY,
    };
  });
};

export type DedupeMethod = "exact" | "none" | "superset" | "would-drop";

export type DedupeResult = {
  analysis: BodyAnalysis;
  /** What taking the final version would produce. Reporting only when method is would-drop. */
  candidate: string;
  changed: boolean;
  /** Prose in a superseded version and absent from the final one. Empty unless would-drop. */
  dropped: Array<DroppedBlock>;
  method: DedupeMethod;
  removedBlocks: number;
  /** Always safe to write. Equals the input when nothing may be changed. */
  text: string;
};

export const dedupeBody = (body: string): DedupeResult => {
  const analysis = analyzeBody(body);
  const unchanged = {
    analysis,
    candidate: body,
    changed: false,
    dropped: [],
    method: "none",
    removedBlocks: 0,
    text: body,
  } as const satisfies DedupeResult;

  if (!analysis.isCorrupt) {
    return unchanged;
  }

  const blocks = splitBlocks(body);
  const segments = splitIntoVersions(blocks);
  const final = segments?.at(-1);
  if (segments === undefined || final === undefined) {
    return unchanged;
  }

  const candidate = final.join("\n\n");
  const survivors = new Set(final);
  const dropped = [...new Set(blocks)].filter((block) => !survivors.has(block));

  if (dropped.length > 0) {
    return {
      analysis,
      candidate,
      changed: false,
      dropped: describeDropped(dropped, final),
      method: "would-drop",
      removedBlocks: blocks.length - final.length,
      text: body,
    };
  }

  return {
    analysis,
    candidate,
    changed: candidate !== body,
    dropped: [],
    method: isNestedChain(segments) ? "exact" : "superset",
    removedBlocks: blocks.length - final.length,
    text: candidate,
  };
};
