import { AMBIGUOUS, FINITE, IMPERATIVE, NOUN_FOLLOWERS, SUBORDINATOR } from "./pt-verbs";

const CLAUSE_END = /[.!?;](?=\s|$)/v;

const MASK_RE = new RegExp(
  `${String.fromCodePoint(0)}${String.raw`\d*`}${String.fromCodePoint(0)}?`,
  "gv",
);

const clean = (tail: string): string =>
  tail
    .replaceAll(MASK_RE, " ")
    .replaceAll(/\([^\)]*\)/gv, " ")
    .replaceAll(/\[[^\]]*\]/gv, " ")
    .replaceAll(/`[^`]*`/gv, " ")
    .replaceAll(/https?:\/\/\S+/gv, " ");

const tailClause = (tail: string): string => {
  const flat = tail.replaceAll(MASK_RE, " ");
  const m = CLAUSE_END.exec(flat);
  return (m === null ? flat : flat.slice(0, m.index)).trim();
};

/**
 * True when the tail's own main verb is finite, so the dash joins two
 * independent statements rather than appending a noun phrase.
 */
export const isClauseTail = (tail: string): boolean => {
  const raw = clean(tailClause(tail))
    .split(/[^\p{L}\p{N}]+/v)
    .filter(Boolean);
  const words = raw.map((w) => w.toLowerCase());
  for (const [i, w] of words.entries()) {
    if (SUBORDINATOR.has(w)) {
      return false;
    }
    if (i > 0 && (raw[i] ?? "") !== w) {
      continue;
    }
    if (AMBIGUOUS.has(w)) {
      if (i > 0 || NOUN_FOLLOWERS.has(words[i + 1] ?? "")) {
        continue;
      }
      return true;
    }
    if (FINITE.has(w) || IMPERATIVE.has(w)) {
      return true;
    }
  }
  return false;
};
