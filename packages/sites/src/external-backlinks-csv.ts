const BOM = "﻿";

const SITE_HEADER_PATTERNS = ["site", "linking site", "domain"];
const LINKING_PAGES_HEADER_PATTERNS = ["pages linking to your site", "linking pages", "pages"];

export type ExternalBacklinkRow = {
  linkingPages: number;
  sourceDomain: string;
};

// RFC 4180-ish CSV line tokenizer. Handles commas inside quoted values and
// `""` as an escaped quote inside a quoted field. GSC exports don't normally
// quote anything, but we still tolerate it so a user-edited CSV does not
// silently mangle a domain with a comma in it.
const parseCsvLine = (line: string): Array<string> => {
  const out: Array<string> = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
};

const stripBom = (s: string): string => (s.startsWith(BOM) ? s.slice(BOM.length) : s);

const normalizeHeader = (s: string): string =>
  s
    .toLowerCase()
    .replaceAll(/[\-_]+/gv, " ")
    .trim();

const matchHeader = (cell: string, patterns: ReadonlyArray<string>): boolean => {
  const n = normalizeHeader(cell);
  return patterns.includes(n);
};

const stripScheme = (raw: string): string =>
  raw
    .replace(/^https?:\/\//iv, "")
    .replace(/^\/\//v, "")
    .replace(/\/.*$/v, "")
    .replace(/^www\./iv, "")
    .toLowerCase()
    .trim();

const isValidDomain = (s: string): boolean => /^[a-z0-9.\-]+\.[a-z]{2,}$/iv.test(s);

export type ParseExternalBacklinksCsvOptions = {
  selfDomain?: string;
};

export type ParseExternalBacklinksCsvResult = {
  rows: Array<ExternalBacklinkRow>;
  skipped: number;
};

export const parseExternalBacklinksCsv = (
  csv: string,
  options: ParseExternalBacklinksCsvOptions = {},
): ParseExternalBacklinksCsvResult => {
  const text = stripBom(csv).replaceAll(/\r\n?/gv, "\n");
  const lines = text.split("\n");
  const selfDomain =
    options.selfDomain !== undefined && options.selfDomain !== ""
      ? stripScheme(options.selfDomain)
      : "";

  let siteIndex = -1;
  let pagesIndex = -1;
  let headerSeen = false;

  const rows: Array<ExternalBacklinkRow> = [];
  const seenDomains = new Set<string>();
  let skipped = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    const cells = parseCsvLine(line);

    if (!headerSeen) {
      const siteCandidate = cells.findIndex((c) => matchHeader(c, SITE_HEADER_PATTERNS));
      const pagesCandidate = cells.findIndex((c) => matchHeader(c, LINKING_PAGES_HEADER_PATTERNS));
      if (siteCandidate !== -1 && pagesCandidate !== -1 && siteCandidate !== pagesCandidate) {
        siteIndex = siteCandidate;
        pagesIndex = pagesCandidate;
        headerSeen = true;
      }
      continue;
    }

    const rawSite = cells[siteIndex] ?? "";
    const rawPages = cells[pagesIndex] ?? "";
    const sourceDomain = stripScheme(rawSite);
    const linkingPages = Math.trunc(Number(rawPages.replaceAll(/\D/gv, "")));

    if (
      sourceDomain.length === 0 ||
      !isValidDomain(sourceDomain) ||
      !Number.isFinite(linkingPages) ||
      linkingPages <= 0
    ) {
      skipped++;
      continue;
    }
    if (selfDomain && sourceDomain === selfDomain) {
      skipped++;
      continue;
    }
    if (seenDomains.has(sourceDomain)) {
      skipped++;
      continue;
    }
    seenDomains.add(sourceDomain);
    rows.push({ linkingPages, sourceDomain });
  }

  return { rows, skipped };
};
