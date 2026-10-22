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
  /** Substantial blocks beyond the first occurrence of each. The decision metric. */
  duplicatedSubstantial: number;
  isCorrupt: boolean;
};

export const analyzeBody = (body: string): BodyAnalysis => {
  const substantial = splitBlocks(body).filter((b) => b.length >= MIN_SUBSTANTIAL_CHARS);
  const duplicatedSubstantial = substantial.length - new Set(substantial).size;

  return {
    duplicatedSubstantial,
    isCorrupt: duplicatedSubstantial >= CORRUPTION_THRESHOLD,
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
 * Takes the final version only when it holds every block of the earlier ones,
 * so no prose is ever dropped. Anything else is left untouched.
 */
export const dedupeBody = (body: string): string => {
  if (!analyzeBody(body).isCorrupt) {
    return body;
  }

  const blocks = splitBlocks(body);
  const final = splitIntoVersions(blocks)?.at(-1);

  if (final === undefined) {
    return body;
  }

  const survivors = new Set(final);

  return blocks.every((block) => survivors.has(block)) ? final.join("\n\n") : body;
};
