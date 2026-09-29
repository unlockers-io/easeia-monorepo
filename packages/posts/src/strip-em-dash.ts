import { isClauseTail } from "./pt-clause";

const EM_DASH = String.fromCodePoint(8212);
const EN_DASH = String.fromCodePoint(8211);
const NBSP = String.fromCodePoint(160);

const SPACE_CLASS = `\\s${NBSP}`;

export type StripKind = "markdown" | "text" | "title";

/**
 * Single source of truth for the rule set. Reporting derives its ordering from
 * this array, so a rule added to the transform can never go uncounted in the
 * report the way `enumeration-parenthetical` briefly did.
 */
export const STRIP_RULES = [
  "appended-comma",
  "clause-colon",
  "clause-semicolon",
  "dangling",
  "enumeration-colon",
  "enumeration-parenthetical",
  "label-colon",
  "numeric-range",
  "paired-appositive",
  "paired-commas",
  "subtitle-colon",
] as const;

export type StripRule = (typeof STRIP_RULES)[number];

export type StripResult = {
  changed: boolean;
  counts: Record<StripRule, number>;
  text: string;
};

const emptyCounts = () =>
  ({
    "appended-comma": 0,
    "clause-colon": 0,
    "clause-semicolon": 0,
    dangling: 0,
    "enumeration-colon": 0,
    "enumeration-parenthetical": 0,
    "label-colon": 0,
    "numeric-range": 0,
    "paired-appositive": 0,
    "paired-commas": 0,
    "subtitle-colon": 0,
  }) satisfies Record<StripRule, number>;

const PROTECTED_SOURCE = [
  String.raw`(?<![\s\S])---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)`,
  String.raw`\x60\x60\x60[\s\S]*?\x60\x60\x60`,
  String.raw`~~~[\s\S]*?~~~`,
  String.raw`\x60+[^\x60]*\x60+`,
  String.raw`\]\([^\)]*\)`,
  String.raw`<[^<>\s][^<>]*>`,
  String.raw`^[ \t]{0,3}\[[^\]]+\]:[^\n]*`,
  String.raw`https?://\S+`,
].join("|");

const CONNECTORS = new Set([
  "afinal",
  "ainda",
  "além",
  "antes",
  "apesar",
  "após",
  "até",
  "com",
  "como",
  "confira",
  "consulte",
  "cuja",
  "cujo",
  "desde",
  "e",
  "enquanto",
  "entre",
  "inclusive",
  "incluindo",
  "isso",
  "isto",
  "mas",
  "mesmo",
  "não",
  "nem",
  "onde",
  "ou",
  "para",
  "pois",
  "por",
  "porque",
  "principalmente",
  "quando",
  "que",
  "quem",
  "se",
  "seja",
  "sem",
  "sobre",
  "sobretudo",
  "tanto",
  "veja",
]);

const LINE_MARKER_RE = /^[ \t]*(?:[>#]+[ \t]*|[\-*+][ \t]+|\d+[.\)][ \t]+|\*{1,2}|_{1,2})*/v;

const SENTENCE_BREAK_RE = new RegExp(`[.!?;][${SPACE_CLASS}]`, "v");
const TRAILING_SPACE_RE = new RegExp(`[${SPACE_CLASS}]+$`, "v");
const SPACE_SPLIT_RE = new RegExp(`[${SPACE_CLASS}]+`, "v");

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= "0" && c <= "9";

const INTERIOR_MAX = 140;

/**
 * A paired appositive is two dashes inside one clause. `1.000 Wh` and `vs.`
 * put a period mid-interior, so a bare `.` cannot end the clause: only a
 * sentence break (terminal punctuation followed by whitespace) does.
 */
const isPairInterior = (interior: string): boolean =>
  interior.trim().length > 0 &&
  interior.length <= INTERIOR_MAX &&
  !SENTENCE_BREAK_RE.test(interior) &&
  !interior.includes(EM_DASH);

const firstToken = (tail: string): string =>
  (/^[\p{L}\p{N}]+/v.exec(tail.trimStart())?.[0] ?? "").toLowerCase();

/** Text up to the end of the clause the dash opens. */
const clauseTail = (tail: string): string => {
  const m = SENTENCE_BREAK_RE.exec(tail);
  return m === null ? tail : tail.slice(0, m.index);
};

const HEAD_LABEL_MAX_WORDS = 4;

const CLAUSE_START_RE = new RegExp(`[.!?;][${SPACE_CLASS}]+`, "gv");

/** The head of the clause the dash sits in, not of the whole line. */
const clauseHead = (head: string): string => {
  let start = 0;
  CLAUSE_START_RE.lastIndex = 0;
  let m = CLAUSE_START_RE.exec(head);
  while (m !== null) {
    start = m.index + m[0].length;
    m = CLAUSE_START_RE.exec(head);
  }
  return head.slice(start);
};

const TIME_COLON_RE = /(?<=\d):(?=\d)/gv;

// Plain-text kinds are not masked, so a bare "https://" in an excerpt would
// otherwise read as the sentence's colon.
const URL_RE = /https?:\/\/\S+/gv;

const hasProseColon = (span: string): boolean =>
  span.replaceAll(URL_RE, "URL").replaceAll(TIME_COLON_RE, "").includes(":");

const SENTENCE_START_RE = new RegExp(`[.!?][${SPACE_CLASS}]+(?=\\p{Lu})`, "gv");

/** The current sentence up to the dash. Wider than clauseHead, which stops at `;`. */
const sentenceHead = (head: string): string => {
  let start = 0;
  SENTENCE_START_RE.lastIndex = 0;
  let m = SENTENCE_START_RE.exec(head);
  while (m !== null) {
    start = m.index + m[0].length;
    m = SENTENCE_START_RE.exec(head);
  }
  return head.slice(start);
};

/** The current sentence from the dash onward. Mirror of sentenceHead. */
const sentenceTail = (tail: string): string => {
  const m = new RegExp(`[.!?][${SPACE_CLASS}]+(?=\\p{Lu})`, "v").exec(tail);
  return m === null ? tail : tail.slice(0, m.index);
};

const isLabelHead = (head: string): boolean => {
  const bare = clauseHead(head).replace(LINE_MARKER_RE, "").trim();
  if (bare === "" || bare.includes(",")) {
    return false;
  }
  return bare.split(SPACE_SPLIT_RE).length <= HEAD_LABEL_MAX_WORDS;
};

const PARENTHETICAL_MAX = 200;

/** Unclosed "(" count, so a dash sitting inside someone else's parenthesis is visible. */
const openParenDepth = (span: string): number => {
  let depth = 0;
  for (const ch of span) {
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")" && depth > 0) {
      depth -= 1;
    }
  }
  return depth;
};

/**
 * Text from the dash to the end of its clause, when that text is an
 * enumeration this rule can safely wrap in parentheses.
 */
const parentheticalTail = (tail: string, head: string): string | null => {
  const trimmed = tail.trimStart();
  const m = new RegExp(`[.!?;](?=[${SPACE_CLASS}]|$)`, "v").exec(trimmed);
  const inner = (m === null ? trimmed : trimmed.slice(0, m.index)).trimEnd();
  if (
    !inner.includes(",") ||
    inner.includes(EM_DASH) ||
    inner.includes("(") ||
    inner.includes(")") ||
    openParenDepth(head) > 0
  ) {
    return null;
  }
  return inner.length > 0 && inner.length <= PARENTHETICAL_MAX ? inner : null;
};

type Replacement = { rule: StripRule; text: string; wrap?: string };

const singleReplacement = (head: string, tail: string, kind: StripKind): Replacement => {
  if (/[,:;?!]$/v.test(head.replace(TRAILING_SPACE_RE, ""))) {
    return { rule: "dangling", text: " " };
  }
  if (kind === "title" && !head.includes(":") && /^\p{Lu}/v.test(tail.trimStart())) {
    return { rule: "subtitle-colon", text: ": " };
  }
  if (CONNECTORS.has(firstToken(tail))) {
    return { rule: "appended-comma", text: ", " };
  }
  const colonTaken = hasProseColon(sentenceHead(head)) || hasProseColon(sentenceTail(tail));

  const labelHead = isLabelHead(head);
  if (!colonTaken && labelHead) {
    return { rule: "label-colon", text: ": " };
  }
  if (clauseTail(tail).includes(",")) {
    if (!colonTaken) {
      return { rule: "enumeration-colon", text: ": " };
    }
    const inner = labelHead ? null : parentheticalTail(tail, head);
    if (inner !== null) {
      return { rule: "enumeration-parenthetical", text: " (", wrap: inner };
    }
  }
  if (!labelHead && isClauseTail(tail)) {
    return colonTaken
      ? { rule: "clause-semicolon", text: "; " }
      : { rule: "clause-colon", text: ": " };
  }
  return { rule: "appended-comma", text: ", " };
};

const leadingSpaceWidth = (s: string): number => s.length - s.trimStart().length;

/**
 * Rewrites one line of free prose. Lines are the unit because a markdown hard
 * break ends a paragraph in this corpus, so a pair never legitimately straddles
 * one, and per-line work keeps the label rule anchored to the real line start.
 */
const stripLine = (line: string, counts: Record<StripRule, number>, kind: StripKind): string => {
  if (!line.includes(EM_DASH)) {
    return line;
  }

  let out = "";
  let cursor = 0;

  while (cursor <= line.length) {
    const at = line.indexOf(EM_DASH, cursor);
    if (at === -1) {
      out += line.slice(cursor);
      break;
    }

    const before = line[at - 1];
    const after = line[at + 1];

    if (isDigit(before) && isDigit(after)) {
      out += line.slice(cursor, at) + EN_DASH;
      counts["numeric-range"] += 1;
      cursor = at + 1;
      continue;
    }

    const closing = line.indexOf(EM_DASH, at + 1);
    const interior = closing === -1 ? "" : line.slice(at + 1, closing);
    const trailing = closing === -1 ? "" : line.slice(closing + 1);
    if (closing !== -1 && isPairInterior(interior) && trailing.trim() !== "") {
      const headText = line.slice(cursor, at).replace(TRAILING_SPACE_RE, "");
      const openGap = headText === "" && out.replace(LINE_MARKER_RE, "").trim() === "" ? "" : " ";
      const closeGap = /^[,.;:!?\)\]]/v.test(trailing.trimStart()) ? "" : " ";
      if (interior.includes("(") || openParenDepth(line.slice(0, at)) > 0) {
        out += `${headText}, ${interior.trim()},${closeGap}`;
        counts["paired-commas"] += 1;
      } else {
        out += `${headText}${openGap}(${interior.trim()})${closeGap}`;
        counts["paired-appositive"] += 1;
      }
      cursor = closing + 1 + leadingSpaceWidth(trailing);
      continue;
    }

    const head = line.slice(0, at);
    const tail = line.slice(at + 1);

    if (head.trim() === "" || tail.trim() === "") {
      out += line.slice(cursor, at).replace(TRAILING_SPACE_RE, "");
      counts.dangling += 1;
      cursor = at + 1 + leadingSpaceWidth(tail);
      continue;
    }

    const { rule, text, wrap } = singleReplacement(head, tail, kind);
    out += line.slice(cursor, at).replace(TRAILING_SPACE_RE, "") + text;
    counts[rule] += 1;
    cursor = at + 1 + leadingSpaceWidth(tail);
    if (wrap !== undefined) {
      out += `${wrap})`;
      cursor += wrap.length;
    }
  }

  return out;
};

const stripFreeText = (text: string, counts: Record<StripRule, number>, kind: StripKind): string =>
  text
    .split("\n")
    .map((line) => stripLine(line, counts, kind))
    .join("\n");

const MASK = String.fromCodePoint(0);

type MaskedProtectedText = { spans: Array<string>; text: string };

const maskProtected = (input: string): MaskedProtectedText => {
  const spans: Array<string> = [];
  const text = input.replaceAll(new RegExp(PROTECTED_SOURCE, "gmv"), (span) => {
    const parts = span.split("\n").map((part) => {
      spans.push(part);
      return `${MASK}${spans.length - 1}${MASK}`;
    });
    return parts.join("\n");
  });
  return { spans, text };
};

const unmask = (text: string, spans: Array<string>): string =>
  text.replaceAll(
    new RegExp(`${MASK}(?<index>\\d+)${MASK}`, "gv"),
    (_, i: string) => spans[Number(i)] ?? "",
  );

export const stripEmDash = (input: string, kind: StripKind = "text"): StripResult => {
  const counts = emptyCounts();
  if (!input.includes(EM_DASH)) {
    return { changed: false, counts, text: input };
  }

  const { spans, text: masked } =
    kind === "markdown" ? maskProtected(input) : { spans: [], text: input };
  const text = unmask(stripFreeText(masked, counts, kind), spans);

  return { changed: text !== input, counts, text };
};

export const hasEmDash = (input: string | null | undefined): input is string =>
  typeof input === "string" && input.includes(EM_DASH);
